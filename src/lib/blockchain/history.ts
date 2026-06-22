// ============================================================
// lib/blockchain/history.ts
//
// Transaction history is read LIVE from the Blockscout API (Arc testnet
// explorer at testnet.arcscan.app) — NOT from localStorage. We query the logs
// emitted by the ArcSender contract and keep only the events whose indexed
// `sender` matches the connected wallet, covering both token and NFT batches:
//
//   event TokensSent(address indexed token, address indexed sender, uint256 recipientCount);
//   event Erc721Sent(address indexed token, address indexed sender, uint256 recipientCount);
//   event Erc1155Sent(address indexed token, address indexed sender, uint256 recipientCount);
//   event MultiCollectionNftSent(address indexed sender, uint256 recipientCount);
//
// Because the data is fetched on demand, nothing is stored in the browser and
// the history naturally disappears when the tab/window is closed.
// ============================================================

import { toEventSelector, type Address } from "viem";
import { arcTestnet } from "./provider";

const EXPLORER_BASE =
  arcTestnet.blockExplorers?.default.url ?? "https://testnet.arcscan.app";
const API_V2 = `${EXPLORER_BASE}/api/v2`;

const CONTRACT = (process.env.NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS ?? "") as string;

// topic0 (event signature hashes)
const SEL = {
  tokens:  toEventSelector("TokensSent(address,address,uint256)").toLowerCase(),
  erc721:  toEventSelector("Erc721Sent(address,address,uint256)").toLowerCase(),
  erc1155: toEventSelector("Erc1155Sent(address,address,uint256)").toLowerCase(),
  mixed:   toEventSelector("MultiCollectionNftSent(address,uint256)").toLowerCase(),
};

export type BatchKind = "Token" | "NFT";

export interface OnChainBatch {
  txHash: string;
  kind: BatchKind;
  standard: string; // ERC-20 (multi-token) | ERC-721 | ERC-1155 | Multi-collection NFT
  recipientCount: number;
  timestamp: string; // ISO 8601 from block_timestamp
  from: string;
}

interface BlockscoutLog {
  topics: (string | null)[];
  data: string;
  transaction_hash: string;
  block_timestamp: string;
}

interface BlockscoutLogsResponse {
  items: BlockscoutLog[];
  next_page_params: Record<string, string | number> | null;
}

// decode a 32-byte indexed address topic → 0x-prefixed address
function topicToAddress(topic: string | null | undefined): string {
  if (!topic || topic.length < 40) return "";
  return ("0x" + topic.slice(-40)).toLowerCase();
}

function dataToCount(data: string | null | undefined): number {
  if (!data || data === "0x") return 0;
  try {
    return Number(BigInt(data));
  } catch {
    return 0;
  }
}

/**
 * Fetch the connected wallet's batch history from Blockscout.
 * Paginates the contract's logs (newest first) and filters by sender == wallet.
 */
export async function fetchOnChainHistory(
  wallet: string,
  opts?: { maxPages?: number; signal?: AbortSignal }
): Promise<OnChainBatch[]> {
  if (!CONTRACT || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT)) {
    throw new Error("MultiSend contract address is not configured.");
  }
  if (!wallet) return [];

  const walletLc = wallet.toLowerCase() as Address;
  const maxPages = opts?.maxPages ?? 12;
  const out: OnChainBatch[] = [];

  let params: Record<string, string> | null = null;

  for (let page = 0; page < maxPages; page++) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${API_V2}/addresses/${CONTRACT}/logs${query}`, {
      headers: { accept: "application/json" },
      signal: opts?.signal,
    });
    if (!res.ok) {
      if (page === 0) throw new Error(`Blockscout request failed (${res.status})`);
      break;
    }

    const json = (await res.json()) as BlockscoutLogsResponse;
    const items = json.items ?? [];

    for (const log of items) {
      const topic0 = (log.topics?.[0] ?? "").toLowerCase();

      let kind: BatchKind | null = null;
      let standard = "";
      let sender = "";

      if (topic0 === SEL.tokens) {
        kind = "Token"; standard = "ERC-20 (multi-token)"; sender = topicToAddress(log.topics[2]);
      } else if (topic0 === SEL.erc721) {
        kind = "NFT"; standard = "ERC-721"; sender = topicToAddress(log.topics[2]);
      } else if (topic0 === SEL.erc1155) {
        kind = "NFT"; standard = "ERC-1155"; sender = topicToAddress(log.topics[2]);
      } else if (topic0 === SEL.mixed) {
        kind = "NFT"; standard = "Multi-collection NFT"; sender = topicToAddress(log.topics[1]);
      }

      if (!kind) continue;
      if (sender !== walletLc) continue;

      out.push({
        txHash: log.transaction_hash,
        kind,
        standard,
        recipientCount: dataToCount(log.data),
        timestamp: log.block_timestamp,
        from: sender,
      });
    }

    const next = json.next_page_params;
    if (!next) break;
    params = Object.fromEntries(
      Object.entries(next).map(([k, v]) => [k, String(v)])
    );
  }

  // newest first
  out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return out;
}
