// ============================================================
// lib/hooks/use-wallet-nfts.ts
// Robust & Adaptive NFT Fetcher for Blockscout API v2
// Dual-mapping support for address/address_hash properties
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

const BLOCKSCOUT_BASE = "https://testnet.arcscan.app";

export interface NFTCollection {
  contractAddress: string;
  name: string;
  symbol: string;
  standard: "ERC721" | "ERC1155";
  tokenIds: string[];
}

async function fetchFromFlatNFTEndpoint(address: string, collectionsMap: Map<string, NFTCollection>) {
  let nextPageParams: Record<string, any> | null = null;
  let page = 0;

  do {
    let url = `${BLOCKSCOUT_BASE}/api/v2/addresses/${address}/nft`;
    
    if (nextPageParams && Object.keys(nextPageParams).length > 0) {
      const searchParams = new URLSearchParams(nextPageParams);
      url += `?${searchParams.toString()}`;
    }

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) break;

    const data = await res.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      if (!item.token) continue;

      // Handle both standard property declarations across different blockscout indexing builds
      const rawAddress = item.token.address || item.token.address_hash;
      if (!rawAddress) continue;

      const rawType = (item.token.type || "").toUpperCase();
      if (!rawType.includes("721") && !rawType.includes("1155")) continue;

      const contractAddr = rawAddress.toLowerCase();
      const tokenId = String(item.id ?? item.token_id ?? "");
      if (!tokenId) continue;

      const standard = rawType.includes("1155") ? "ERC1155" : "ERC721";

      if (collectionsMap.has(contractAddr)) {
        const existing = collectionsMap.get(contractAddr)!;
        if (!existing.tokenIds.includes(tokenId)) {
          existing.tokenIds.push(tokenId);
        }
      } else {
        collectionsMap.set(contractAddr, {
          contractAddress: contractAddr,
          name: item.token.name || `${contractAddr.slice(0, 6)}...${contractAddr.slice(-4)}`,
          symbol: item.token.symbol || "",
          standard,
          tokenIds: [tokenId],
        });
      }
    }

    nextPageParams = data.next_page_params;
    page++;
  } while (nextPageParams && Object.keys(nextPageParams).length > 0 && page < 5);
}

async function fetchFromCollectionsEndpoint(address: string, collectionsMap: Map<string, NFTCollection>) {
  let nextPageParams: Record<string, any> | null = null;
  let page = 0;

  do {
    let url = `${BLOCKSCOUT_BASE}/api/v2/addresses/${address}/nft/collections`;
    
    if (nextPageParams && Object.keys(nextPageParams).length > 0) {
      const searchParams = new URLSearchParams(nextPageParams);
      url += `?${searchParams.toString()}`;
    }

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) break;

    const data = await res.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      if (!item.token) continue;

      const rawAddress = item.token.address || item.token.address_hash;
      if (!rawAddress) continue;

      const rawType = (item.token.type || "").toUpperCase();
      if (!rawType.includes("721") && !rawType.includes("1155")) continue;

      const contractAddr = rawAddress.toLowerCase();
      const standard = rawType.includes("1155") ? "ERC1155" : "ERC721";

      const tokenInstances = item.token_instances || [];
      const tokenIds: string[] = tokenInstances
        .map((t: any) => String(t.id ?? t.token_id ?? ""))
        .filter(Boolean);

      if (tokenIds.length === 0) continue;

      if (collectionsMap.has(contractAddr)) {
        const existing = collectionsMap.get(contractAddr)!;
        const merged = Array.from(new Set([...existing.tokenIds, ...tokenIds]));
        existing.tokenIds = merged;
      } else {
        collectionsMap.set(contractAddr, {
          contractAddress: contractAddr,
          name: item.token.name || `${contractAddr.slice(0, 6)}...${contractAddr.slice(-4)}`,
          symbol: item.token.symbol || "",
          standard,
          tokenIds,
        });
      }
    }

    nextPageParams = data.next_page_params;
    page++;
  } while (nextPageParams && Object.keys(nextPageParams).length > 0 && page < 5);
}

export async function fetchAllNFTCollections(address: string): Promise<NFTCollection[]> {
  const collectionsMap = new Map<string, NFTCollection>();

  try {
    await fetchFromFlatNFTEndpoint(address, collectionsMap);
  } catch (err) {
    console.error("Flat endpoint lookup failed:", err);
  }

  try {
    await fetchFromCollectionsEndpoint(address, collectionsMap);
  } catch (err) {
    console.error("Collections grouping endpoint lookup failed:", err);
  }

  return Array.from(collectionsMap.values())
    .map((col) => ({
      ...col,
      tokenIds: col.tokenIds.sort((a, b) => {
        // Extract the trailing digits if dealing with composite paths (e.g., "prefix/id")
        const cleanA = a.includes("/") ? a.split("/").pop() || a : a;
        const cleanB = b.includes("/") ? b.split("/").pop() || b : b;
        
        const numA = parseInt(cleanA, 10);
        const numB = parseInt(cleanB, 10);
        return isNaN(numA) || isNaN(numB) ? a.localeCompare(b) : numA - numB;
      }),
    }))
    .filter((col) => col.tokenIds.length > 0);
}

export function useWalletNFTs() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ["walletNFTs", address?.toLowerCase()],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected");
      return fetchAllNFTCollections(address);
    },
    enabled: isConnected && !!address,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}