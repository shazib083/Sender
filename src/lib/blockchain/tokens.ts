// ============================================================
// lib/blockchain/tokens.ts
// Token registry and ERC-20 ABI for Arc Testnet
// ============================================================

import { type Token, type TokenSymbol } from "@/types";

// Minimal ERC-20 ABI (approve + transfer + balanceOf + allowance)
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
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

// ---- Token Registry ----
// IMPORTANT: Set real Arc Testnet contract addresses in Vercel env vars:
//   NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0xYOUR_REAL_USDC_ADDRESS
//   NEXT_PUBLIC_EURC_CONTRACT_ADDRESS=0xYOUR_REAL_EURC_ADDRESS
// Decimals must match the actual deployed contract (call decimals() on explorer to verify)
export const TOKEN_REGISTRY: Record<TokenSymbol, Token> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS ?? "0x3600000000000000000000000000000000000000",
    logoUrl: "/tokens/usdc.svg",
    isNative: false,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    address: process.env.NEXT_PUBLIC_EURC_CONTRACT_ADDRESS ?? "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    logoUrl: "/tokens/eurc.svg",
    isNative: false,
  },
  ETH: {
    symbol: "ETH",
    name: "ARC (Native)",
    decimals: 18,
    address: "",
    logoUrl: "/tokens/eth.svg",
    isNative: true,
  },
};

export const SUPPORTED_TOKENS: Token[] = Object.values(TOKEN_REGISTRY);

export function getToken(symbol: TokenSymbol): Token {
  return TOKEN_REGISTRY[symbol];
}

// ---- Amount formatting utilities ----
export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === "." || amount === "") return BigInt(0);
  const parts = amount.split(".");
  const whole = BigInt(parts[0] ?? "0");
  const decimalStr = (parts[1] ?? "").padEnd(decimals, "0").slice(0, decimals);
  const decimal = BigInt(decimalStr);
  return whole * BigInt(10 ** decimals) + decimal;
}

export function formatTokenAmount(amount: bigint, decimals: number, precision = 6): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  const remainderStr = remainder.toString().padStart(decimals, "0").slice(0, precision);
  const trimmed = remainderStr.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export function formatUsdAmount(amount: bigint, decimals: number): string {
  const formatted = formatTokenAmount(amount, decimals, 2);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(formatted));
}

// ---- Validation ----
export function isValidPositiveAmount(value: string): boolean {
  if (!value || value.trim() === "") return false;
  const num = parseFloat(value);
  return !isNaN(num) && num > 0 && isFinite(num);
}