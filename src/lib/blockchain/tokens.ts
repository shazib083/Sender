// ============================================================
// lib/blockchain/tokens.ts
// Arc Testnet token registry
// USDC pays gas natively on Arc, but multisend uses its ERC-20 interface.
// EURC/cirBTC are standard ERC-20 tokens.
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

// ============================================================
// TOKEN REGISTRY
// Arc Testnet:
//   USDC = native gas token with optional ERC-20 interface, decimals: 6
//          This app uses the ERC-20 interface for contract multisend.
//   EURC = standard ERC-20, isNative: false, decimals: 6
//   cirBTC = standard ERC-20, isNative: false, decimals: 8
// ============================================================
export const TOKEN_REGISTRY: Record<TokenSymbol, Token> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0x3600000000000000000000000000000000000000",
    logoUrl: "/usdc.png",
    isNative: false,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    address:
      process.env.NEXT_PUBLIC_EURC_CONTRACT_ADDRESS ??
      "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    logoUrl: "/eurc.png",
    isNative: false,
  },
  cirBTC: {
    symbol: "cirBTC",
    name: "Circle Wrapped Bitcoin",
    decimals: 8,
    address: process.env.NEXT_PUBLIC_CIRBTC_CONTRACT_ADDRESS ?? "",
    logoUrl: "/cirbtc.png",
    isNative: false,
  },
};

export const SUPPORTED_TOKENS: Token[] = Object.values(TOKEN_REGISTRY);

export function getToken(symbol: TokenSymbol): Token {
  return TOKEN_REGISTRY[symbol];
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount) return BigInt(0);
  const clean = amount.toString().trim();
  const [whole, decimal = ""] = clean.split(".");
  const padded = decimal.padEnd(decimals, "0").slice(0, decimals);
  return (
    BigInt(whole || "0") * BigInt(10 ** decimals) + BigInt(padded || "0")
  );
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
