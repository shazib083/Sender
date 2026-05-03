// ============================================================
// lib/hooks/use-token-balances.ts
// Arc Testnet: USDC is native gas token
// eth_getBalance returns 18-decimal wei
// USDC ERC-20 interface uses 6 decimals
// We store balance in 6-decimal units for consistent display
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createArcPublicClient } from "@/lib/blockchain/provider";
import { ERC20_ABI, TOKEN_REGISTRY, formatTokenAmount } from "@/lib/blockchain/tokens";
import type { TokenBalance, TokenSymbol } from "@/types";
import type { Address } from "viem";

async function fetchTokenBalances(address: string): Promise<TokenBalance[]> {
  const client = createArcPublicClient();
  const results: TokenBalance[] = [];

  for (const token of Object.values(TOKEN_REGISTRY)) {
    try {
      let balance: bigint;

      if (token.symbol === "USDC") {
        // Arc: USDC native balance comes back as 18-decimal wei
        // Convert to 6-decimal units: divide by 10^12
        const rawBalance = await client.getBalance({ address: address as Address });
        balance = rawBalance / BigInt(10 ** 12);
      } else if (token.symbol === "ETH") {
        // ETH slot also shows native balance — same conversion
        const rawBalance = await client.getBalance({ address: address as Address });
        balance = rawBalance / BigInt(10 ** 12);
      } else if (token.isNative) {
        const rawBalance = await client.getBalance({ address: address as Address });
        balance = rawBalance / BigInt(10 ** 12);
      } else {
        // Standard ERC-20 (EURC etc.) — already in correct decimals
        balance = (await client.readContract({
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as Address],
        })) as bigint;
      }

      results.push({
        token,
        balance,
        formatted: formatTokenAmount(balance, token.decimals),
      });
    } catch {
      results.push({
        token,
        balance: BigInt(0),
        formatted: "0",
      });
    }
  }

  return results;
}

export function useTokenBalances() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ["tokenBalances", address],
    queryFn: () => fetchTokenBalances(address!),
    enabled: isConnected && !!address,
    refetchInterval: 15_000,
    staleTime: 10_000,
    select: (data) => {
      const map = {} as Record<TokenSymbol, TokenBalance>;
      for (const balance of data) {
        map[balance.token.symbol as TokenSymbol] = balance;
      }
      return { list: data, map };
    },
  });
}

export function useBalanceMap(): Record<TokenSymbol, bigint> {
  const { data } = useTokenBalances();
  if (!data) return {} as Record<TokenSymbol, bigint>;
  const result = {} as Record<TokenSymbol, bigint>;
  for (const [symbol, tb] of Object.entries(data.map)) {
    result[symbol as TokenSymbol] = tb.balance;
  }
  return result;
}