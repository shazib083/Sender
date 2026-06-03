import { NextResponse } from "next/server";
import { createArcPublicClient } from "@/lib/blockchain/provider";
import { MULTISEND_CONTRACT_ADDRESS } from "@/lib/blockchain/multisend";
import { TOKEN_REGISTRY, parseTokenAmount } from "@/lib/blockchain/tokens";
import type { RecipientRow, TokenSymbol } from "@/types";
import { isAddress, zeroAddress } from "viem";

const NATIVE_ABI = [
  {
    name: "multisendNative",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

const TOKEN_ABI = [
  {
    name: "multisend",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "multisendToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

const NATIVE_USDC_DECIMAL_OFFSET = BigInt(10 ** 12);

function toNativeValue(amount: bigint): bigint {
  return amount * NATIVE_USDC_DECIMAL_OFFSET;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: RecipientRow[] = body.rows ?? [];

    if (rows.length === 0) {
      return NextResponse.json({ gasEstimate: "0", ok: true });
    }

    const client = createArcPublicClient();

    const grouped = rows.reduce(
      (acc, row) => {
        acc[row.tokenSymbol] = [...(acc[row.tokenSymbol] ?? []), row];
        return acc;
      },
      {} as Record<string, RecipientRow[]>
    );

    let totalGas = BigInt(0);
    const errors: string[] = [];

    for (const [symbol, tokenRows] of Object.entries(grouped)) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];
      const recipients = tokenRows
        .map((r) => r.address)
        .filter((a) => isAddress(a)) as `0x${string}`[];
      const amounts = tokenRows.map((r) =>
        parseTokenAmount(r.amount, token.decimals)
      );

      if (recipients.length !== tokenRows.length) {
        errors.push(`Some addresses in ${symbol} group are invalid`);
        continue;
      }

      if (MULTISEND_CONTRACT_ADDRESS === zeroAddress) {
        totalGas = totalGas + BigInt(tokenRows.length) * BigInt(65000);
      } else {
        try {
          let gas: bigint;

          if (token.isNative) {
            const nativeAmounts = amounts.map(toNativeValue);
            const nativeTotal = nativeAmounts.reduce((a, b) => a + b, BigInt(0));

            gas = await client.estimateContractGas({
              address: MULTISEND_CONTRACT_ADDRESS,
              abi: NATIVE_ABI,
              functionName: "multisendNative",
              args: [recipients, nativeAmounts],
              account: zeroAddress,
              value: nativeTotal,
            });
          } else {
            gas = await client.estimateContractGas({
              address: MULTISEND_CONTRACT_ADDRESS,
              abi: TOKEN_ABI,
              functionName: "multisend",
              args: [token.address as `0x${string}`, recipients, amounts],
              account: zeroAddress,
            });
          }

          totalGas = totalGas + gas;
        } catch {
          totalGas = totalGas + BigInt(tokenRows.length) * BigInt(65000);
        }
      }
    }

    return NextResponse.json({
      gasEstimate: totalGas.toString(),
      ok: errors.length === 0,
      errors,
    });
  } catch (error) {
    console.error("Simulate error:", error);
    return NextResponse.json(
      { error: "Simulation failed", gasEstimate: "0", ok: false },
      { status: 500 }
    );
  }
}
