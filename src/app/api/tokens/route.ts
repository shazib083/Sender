import { NextResponse } from "next/server";
import { getCircleWalletBalances, getCircleWallets } from "@/lib/blockchain/circle-adapter";

// GET /api/tokens?walletAddress=0x...
// Returns Circle-managed token balances for a given wallet address.
// NOTE: This endpoint is server-side only — CIRCLE_API_KEY is never exposed to the browser.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("walletAddress");

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  try {
    // Find the Circle wallet that matches the given on-chain address
    const wallets = await getCircleWallets();
    const matched = wallets.find(
      (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!matched) {
      // No Circle-managed wallet found — return empty; UI falls back to direct on-chain read
      return NextResponse.json({ balances: [] });
    }

    const balances = await getCircleWalletBalances(matched.id);
    return NextResponse.json({ balances, walletId: matched.id });
  } catch (error) {
    console.error("Circle token balance error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Circle token balances", balances: [] },
      { status: 500 }
    );
  }
}
