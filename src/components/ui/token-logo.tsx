"use client";

import { TOKEN_REGISTRY } from "@/lib/blockchain/tokens";
import type { TokenSymbol } from "@/types";
import { cn } from "./utils";

interface TokenLogoProps {
  symbol: TokenSymbol;
  size?: number;
  className?: string;
}

export function TokenLogo({ symbol, size = 24, className }: TokenLogoProps) {
  const token = TOKEN_REGISTRY[symbol];

  return (
    <span
      className={cn("inline-flex shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={token.logoUrl}
        alt={`${symbol} logo`}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
