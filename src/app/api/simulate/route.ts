import { NextResponse } from "next/server";
import { createArcPublicClient } from "@/lib/blockchain/provider";
import { MULTISEND_ABI, MULTISEND_CONTRACT_ADDRESS } from "@/lib/blockchain/multisend";
import { TOKEN_REGISTRY, parseTokenAmount } from "@/lib/blockchain/tokens";
import type { RecipientRow, TokenSymbol } from "@/types";
import { isAddress, zeroAddress } from "viem";

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
            gas = await client.estimateContractGas({
              address: MULTISEND_CONTRACT_ADDRESS,
              abi: MULTISEND_ABI,
              functionName: "multisendNative",
              args: [recipients, amounts],
              account: zeroAddress,
            });
          } else {
            gas = await client.estimateContractGas({
              address: MULTISEND_CONTRACT_ADDRESS,
              abi: MULTISEND_ABI,
              functionName: "multisendToken",
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