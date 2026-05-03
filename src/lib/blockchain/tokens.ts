// ============================================================
// lib/blockchain/tokens.ts
// FIXED EXPORT VERSION (SUPPORTED_TOKENS GUARANTEED)
// ============================================================

import { type Token, type TokenSymbol } from "@/types";

// ---------------- ERC20 ABI ----------------
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
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ---------------- TOKEN REGISTRY ----------------
export const TOKEN_REGISTRY: Record<TokenSymbol, Token> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0x3600000000000000000000000000000000000000",
    logoUrl: "/tokens/usdc.svg",
    isNative: true,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    address:
      process.env.NEXT_PUBLIC_EURC_CONTRACT_ADDRESS ??
      "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    logoUrl: "/tokens/eurc.svg",
    isNative: false,
  },
  ETH: {
    symbol: "ETH",
    name: "Arc Native",
    decimals: 6,
    address: "",
    logoUrl: "/tokens/eth.svg",
    isNative: true,
  },
};

// ---------------- THIS IS THE FIX ----------------
// MUST exist or build breaks
export const SUPPORTED_TOKENS: Token[] = Object.values(TOKEN_REGISTRY);

// ---------------- HELPERS ----------------
export function getToken(symbol: TokenSymbol): Token {
  return TOKEN_REGISTRY[symbol];
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount) return BigInt(0);

  const [whole, decimal = ""] = amount.split(".");
  const padded = decimal.padEnd(decimals, "0").slice(0, decimals);

  return BigInt(whole || "0") * BigInt(10 ** decimals) + BigInt(padded || "0");
}

export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  precision = 6
): string {
  const base = BigInt(10 ** decimals);
  const whole = amount / base;
  const fraction = amount % base;

  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, precision);
  const trimmed = fractionStr.replace(/0+$/, "");

  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}