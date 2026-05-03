"use client";
import { cn } from "./utils";
import type { TokenSymbol } from "@/types";

interface TokenLogoProps {
  symbol: TokenSymbol;
  size?: number;
  className?: string;
}

// Inline SVG logos to avoid external image dependencies
const LOGOS: Record<TokenSymbol, React.ReactNode> = {
  USDC: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.224-2.192-.672-2.192-1.456 0-.784.616-1.288 1.848-1.288 1.104 0 1.72.368 2.024 1.28.064.192.224.32.416.32h.96c.256 0 .448-.192.448-.448v-.048c-.256-1.408-1.408-2.496-2.88-2.624V9.6c0-.256-.192-.448-.448-.448h-.896c-.256 0-.448.192-.448.448v1.088c-1.664.256-2.72 1.312-2.72 2.72 0 2.016 1.232 2.784 3.792 3.088 1.696.256 2.24.64 2.24 1.504 0 .864-.752 1.472-1.888 1.472-1.472 0-1.984-.576-2.144-1.44-.064-.256-.256-.384-.464-.384h-1.024c-.256 0-.448.192-.448.448v.048c.256 1.536 1.248 2.592 3.104 2.848v1.12c0 .256.192.448.448.448h.896c.256 0 .448-.192.448-.448v-1.12c1.68-.288 2.768-1.408 2.768-2.928z"
        fill="white"
      />
      <path
        d="M13.04 22.48c-3.68-1.312-5.568-5.408-4.24-9.088.672-1.888 2.096-3.376 3.984-4.08.192-.064.32-.256.32-.48V7.84c0-.256-.192-.448-.448-.448-.064 0-.128 0-.192.032C8.4 8.736 5.84 12.4 5.84 16.576c0 5.408 4.4 9.76 9.76 9.76.256 0 .448-.192.448-.448v-1.024c0-.224-.128-.416-.32-.48-.896-.256-1.76-.64-2.688-1.008v.104z"
        fill="white"
        fillOpacity="0.6"
      />
      <path
        d="M19.6 7.424c-.064-.032-.128-.032-.192-.032-.256 0-.448.192-.448.448v.992c0 .224.128.416.32.48 3.68 1.312 5.568 5.408 4.24 9.088-.672 1.888-2.096 3.376-3.984 4.08-.192.064-.32.256-.32.48v.992c0 .256.192.448.448.448.064 0 .128 0 .192-.032 4.064-1.312 6.624-4.976 6.624-9.152 0-5.408-4.4-9.76-9.76-9.76h.88z"
        fill="white"
        fillOpacity="0.6"
      />
    </svg>
  ),
  EURC: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white" fontFamily="sans-serif">€</text>
    </svg>
  ),
  ETH: (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path d="M16 6v7.25L22 16 16 6z" fill="white" fillOpacity="0.6" />
      <path d="M16 6L10 16l6-2.75V6z" fill="white" />
      <path d="M16 21.5V26l6-8.25L16 21.5z" fill="white" fillOpacity="0.6" />
      <path d="M16 26v-4.5L10 17.75 16 26z" fill="white" />
      <path d="M16 20.25l6-3.25-6-2.75v6z" fill="white" fillOpacity="0.2" />
      <path d="M10 17l6 3.25v-6L10 17z" fill="white" fillOpacity="0.6" />
    </svg>
  ),
};

export function TokenLogo({ symbol, size = 24, className }: TokenLogoProps) {
  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {LOGOS[symbol]}
    </span>
  );
}
