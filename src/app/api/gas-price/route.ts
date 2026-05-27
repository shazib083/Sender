import { NextResponse } from "next/server";
import { formatGwei } from "viem";
import { createArcPublicClient } from "@/lib/blockchain/provider";

const ARC_GAS_ORACLE_URL = "https://testnet.arcscan.app/api/v1/gas-price-oracle";

interface ArcGasOracleResponse {
  slow?: number;
  average?: number;
  fast?: number;
}

function isFiniteGasPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export async function GET() {
  try {
    const response = await fetch(ARC_GAS_ORACLE_URL, {
      next: { revalidate: 30 },
    });

    if (response.ok) {
      const data = (await response.json()) as ArcGasOracleResponse;

      if (
        isFiniteGasPrice(data.slow) &&
        isFiniteGasPrice(data.average) &&
        isFiniteGasPrice(data.fast)
      ) {
        return NextResponse.json({
          slow: data.slow,
          average: data.average,
          fast: data.fast,
          source: "arcscan",
        });
      }
    }
  } catch {
    // Fall back to RPC gas price below.
  }

  const client = createArcPublicClient();
  const gasPrice = await client.getGasPrice();
  const gwei = Number(formatGwei(gasPrice));

  return NextResponse.json({
    slow: gwei,
    average: gwei,
    fast: gwei,
    source: "rpc",
  });
}
