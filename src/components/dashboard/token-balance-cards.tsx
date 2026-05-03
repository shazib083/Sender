// ============================================================
// token-balance-cards.tsx (FIXED - NO ETH)
// ============================================================

import React from "react";
import { useTokenBalances } from "@/lib/hooks/use-token-balances";
import type { TokenSymbol } from "@/types";

const DISPLAY_TOKENS: TokenSymbol[] = ["USDC", "EURC"];

export function TokenBalanceCards() {
  const { data, isLoading } = useTokenBalances();

  if (isLoading) {
    return <div>Loading balances...</div>;
  }

  const balancesList = data?.list ?? [];

  return (
    <div className="grid grid-cols-2 gap-4">
      {DISPLAY_TOKENS.map((symbol) => {
        const token = balancesList.find(
          (t) => t.token.symbol === symbol
        );

        return (
          <div
            key={symbol}
            className="p-4 border rounded-lg bg-white shadow-sm"
          >
            <div className="text-sm text-gray-500">
              {symbol}
            </div>

            <div className="text-lg font-semibold">
              {token?.formatted ?? "0.00"}
            </div>
          </div>
        );
      })}
    </div>
  );
}