// ============================================================
// lib/hooks/use-token-balances.ts
// TanStack Query hook to fetch on-chain token balances
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

      if (token.isNative) {
        balance = await client.getBalance({ address: address as Address });
      } else {
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
        balance: 0n,
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
    refetchInterval: 15_000, // every 15s
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
