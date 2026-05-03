// ============================================================
// lib/blockchain/tokens.ts (FIXED)
// ============================================================

import { type Token, type TokenSymbol } from "@/types";

export const ERC20_ABI = [/* unchanged - same as yours */] as const;

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
    name: "ARC Native",
    decimals: 6,
    address: "",
    logoUrl: "/tokens/eth.svg",
    isNative: true,
  },
};

// ---------------- FIXED PARSER ----------------
export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === "." || amount === "") return 0n;

  const [whole, fraction = ""] = amount.split(".");

  const wholeBN = BigInt(whole || "0");

  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);

  const fractionBN = BigInt(padded || "0");

  const base = BigInt(10) ** BigInt(decimals);

  return wholeBN * base + fractionBN;
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;

  return fraction === 0n ? whole.toString() : `${whole}.${fraction}`;
}