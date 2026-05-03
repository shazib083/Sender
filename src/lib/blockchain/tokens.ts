// ============================================================
// lib/blockchain/tokens.ts (ARC TESTNET CORRECT MODEL)
// USDC = Native Gas Token on Arc
// ============================================================

import { type Token, type TokenSymbol } from "@/types";

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ============================================================
// TOKEN REGISTRY (ARC CORRECT)
// ============================================================
export const TOKEN_REGISTRY: Record<TokenSymbol, Token> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin (Arc Native)",
    decimals: 6,
    address: "native",
    logoUrl: "/tokens/usdc.svg",
    isNative: true, // ✅ IMPORTANT FIX
  },

  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    logoUrl: "/tokens/eurc.svg",
    isNative: false,
  },
};

// ============================================================
// FIXED SUPPORTED TOKENS EXPORT
// ============================================================
export const SUPPORTED_TOKENS: Token[] = Object.values(TOKEN_REGISTRY);

// ============================================================
// HELPERS
// ============================================================
export function getToken(symbol: TokenSymbol): Token {
  return TOKEN_REGISTRY[symbol];
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount) return 0n;

  const clean = amount.toString().trim();
  const [whole, decimal = ""] = clean.split(".");

  const padded = decimal.padEnd(decimals, "0").slice(0, decimals);

  return BigInt(whole || "0") * BigInt(10 ** decimals) + BigInt(padded || "0");
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const base = BigInt(10 ** decimals);
  const whole = amount / base;
  const fraction = amount % base;

  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, 6)
    .replace(/0+$/, "");

  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}