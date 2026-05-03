"use client";

import React from "react";
import { cn } from "./utils";
import type { TokenSymbol } from "@/types";

interface TokenLogoProps {
  symbol: TokenSymbol;
  size?: number;
  className?: string;
}

// ============================================================
// INLINE SVG LOGOS (NO ETH)
// ============================================================
const LOGOS: Record<TokenSymbol, React.ReactNode> = {
  USDC: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.224-2.192-.672-2.192-1.456 0-.784.616-1.288 1.848-1.288 1.104 0 1.72.368 2.024 1.28.064.192.224.32.416.32h.96c.256 0 .448-.192.448-.448v-.048c-.256-1.408-1.408-2.496-2.88-2.624V9.6c0-.256-.192-.448-.448-.448h-.896c-.256 0-.448.192-.448.448v1.088c-1.664.256-2.72 1.312-2.72 2.72 0 2.016 1.232 2.784 3.792 3.088 1.696.256 2.24.64 2.24 1.504 0 .864-.752 1.472-1.888 1.472-1.472 0-1.984-.576-2.144-1.44-.064-.256-.256-.384-.464-.384h-1.024c-.256 0-.448.192-.448.448v.048c.256 1.536 1.248 2.592 3.104 2.848v1.12c0 .256.192.448.448.448h.896c.256 0 .448-.192.448-.448v-1.12c1.68-.288 2.768-1.408 2.768-2.928z"
        fill="white"
      />
    </svg>
  ),

  EURC: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="14"
        fontWeight="bold"
        fill="white"
        fontFamily="sans-serif"
      >
        €
      </text>
    </svg>
  ),
};

// ============================================================
// COMPONENT
// ============================================================
export function TokenLogo({
  symbol,
  size = 24,
  className,
}: TokenLogoProps) {
  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {LOGOS[symbol]}
    </span>
  );
}