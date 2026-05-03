import { NextResponse } from "next/server";
import { createArcPublicClient } from "@/lib/blockchain/provider";
import { MULTISEND_ABI, MULTISEND_CONTRACT_ADDRESS } from "@/lib/blockchain/multisend";
import { TOKEN_REGISTRY, parseTokenAmount } from "@/lib/blockchain/tokens";
import type { RecipientRow, TokenSymbol } from "@/types";
import { isAddress, zeroAddress } from "viem";

// POST /api/simulate
// Simulates (eth_estimateGas) a batch before execution.
// Safe to call from the client — no private keys involved.

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: RecipientRow[] = body.rows ?? [];

    if (rows.length === 0) {
      return NextResponse.json({ gasEstimate: "0", ok: true });
    }

    const client = createArcPublicClient();

    // Group rows by token
    const grouped = rows.reduce(
      (acc, row) => {
        acc[row.tokenSymbol] = [...(acc[row.tokenSymbol] ?? []), row];
        return acc;
      },
      {} as Record<string, RecipientRow[]>
    );

    let totalGas = 0n;
    const errors: string[] = [];

    for (const [symbol, tokenRows] of Object.entries(grouped)) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];
      const recipients = tokenRows
        .map((r) => r.address)
        .filter((a) => isAddress(a)) as `0x${string}`[];
      const amounts = tokenRows.map((r) => parseTokenAmount(r.amount, token.decimals));

      if (recipients.length !== tokenRows.length) {
        errors.push(`Some addresses in ${symbol} group are invalid`);
        continue;
      }

      if (MULTISEND_CONTRACT_ADDRESS === zeroAddress) {
        // Estimate sequential: ~65k gas per ERC-20 tx
        totalGas += BigInt(tokenRows.length) * 65000n;
      } else {
        try {
          const gas = await client.estimateContractGas({
            address: MULTISEND_CONTRACT_ADDRESS,
            abi: MULTISEND_ABI,
            functionName: token.isNative ? "multisendNative" : "multisendToken",
            args: token.isNative
              ? [recipients, amounts]
              : [token.address as `0x${string}`, recipients, amounts],
            account: zeroAddress,
          });
          totalGas += gas;
        } catch (e) {
          totalGas += BigInt(tokenRows.length) * 65000n;
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
