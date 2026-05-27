"use client";

import { RefreshCw } from "lucide-react";
import { useTokenBalances } from "@/lib/hooks/use-token-balances";
import { TokenLogo } from "@/components/ui/token-logo";
import { cn } from "@/components/ui/utils";
import { TOKEN_REGISTRY } from "@/lib/blockchain/tokens";
import type { TokenSymbol } from "@/types";

const DISPLAY_TOKENS: TokenSymbol[] = ["USDC", "EURC", "cirBTC"];

export function TokenBalanceCards() {
  const { data, isLoading, refetch, isFetching } = useTokenBalances();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {DISPLAY_TOKENS.map((symbol) => {
        const balance = data?.map[symbol];
        return (
          <BalanceCard
            key={symbol}
            symbol={symbol}
            balance={balance?.formatted ?? "—"}
            isLoading={isLoading}
            onRefresh={refetch}
            isRefreshing={isFetching}
          />
        );
      })}
    </div>
  );
}

interface BalanceCardProps {
  symbol: TokenSymbol;
  balance: string;
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function BalanceCard({
  symbol,
  balance,
  isLoading,
  onRefresh,
  isRefreshing,
}: BalanceCardProps) {
  const token = TOKEN_REGISTRY[symbol];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-surface-300 bg-surface-100 p-5 transition-all hover:border-brand-500/40 hover:shadow-glow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <TokenLogo symbol={symbol} size={40} />
          <div>
            <p className="text-xs font-medium normal-case tracking-wider text-gray-500">
              {token.symbol}
            </p>
            {isLoading ? (
              <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-surface-300" />
            ) : (
              <p className="text-2xl font-bold text-white tabular-nums">
                {balance}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-300 hover:text-gray-300 transition-colors"
          title="Refresh balance"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
        </button>
      </div>
    </div>
  );
}
