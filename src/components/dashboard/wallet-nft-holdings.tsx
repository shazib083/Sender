"use client";
// ============================================================
// components/dashboard/wallet-nft-holdings.tsx
// Shows NFT collections held by the connected wallet
// Data fetched via Blockscout API v2
// ============================================================

import { useState } from "react";
import { Copy, Check, RefreshCw, ImageIcon, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { useWalletNFTs } from "@/lib/hooks/use-wallet-nfts";
import { cn } from "@/components/ui/utils";
import toast from "react-hot-toast";

// ── Copy button ───────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Contract address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded-md p-1 text-gray-500 hover:bg-surface-300 hover:text-gray-300 transition-colors"
      title="Copy contract address"
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-400" />
        : <Copy className="h-3.5 w-3.5" />
      }
    </button>
  );
}

// ── Single collection card ────────────────────────────────────
function NFTCollectionRow({
  name,
  symbol,
  contractAddress,
  standard,
  tokenIds,
}: {
  name: string;
  symbol: string;
  contractAddress: string;
  standard: "ERC721" | "ERC1155";
  tokenIds: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 10;
  const preview = tokenIds.slice(0, PREVIEW);
  const rest    = tokenIds.slice(PREVIEW);

  return (
    <div className="rounded-xl border border-surface-300 bg-transparent dark:bg-surface-200/30 p-4 transition-all hover:bg-surface-200/20 dark:hover:bg-surface-200/50 hover:border-surface-400">

      {/* ── Header: icon + name + badge + count + copy ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
            <ImageIcon className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              {name}
              {symbol ? <span className="ml-1.5 text-xs font-normal text-gray-500">({symbol})</span> : null}
            </span>
          </div>

          <span className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            standard === "ERC721"
              ? "bg-brand-500/20 text-black dark:text-brand-300"
              : "bg-purple-500/20 text-black dark:text-purple-300"
          )}>
            {standard}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-gray-500">
            {tokenIds.length} token{tokenIds.length !== 1 ? "s" : ""}
          </span>
          <CopyButton text={contractAddress} />
        </div>
      </div>

      {/* ── Contract address subtle line ── */}
      <p className="mt-1 ml-9 font-mono text-[10px] text-gray-600">
        {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
      </p>

      {/* ── Token IDs ── */}
      <div className="mt-3 ml-9">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">
          Token IDs
        </p>
        <div className="flex flex-wrap gap-1.5">
          {preview.map((id) => (
            <span
              key={id}
              className="rounded-md bg-surface-300 px-2 py-0.5 font-mono text-xs text-gray-300"
            >
              #{id}
            </span>
          ))}

          {rest.length > 0 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 rounded-md bg-surface-300 px-2 py-0.5 font-mono text-xs text-brand-400 hover:bg-surface-400 transition-colors"
            >
              +{rest.length} more <ChevronDown className="h-3 w-3" />
            </button>
          )}

          {expanded && rest.map((id) => (
            <span
              key={id}
              className="rounded-md bg-surface-300 px-2 py-0.5 font-mono text-xs text-gray-300"
            >
              #{id}
            </span>
          ))}

          {expanded && rest.length > 0 && (
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 rounded-md bg-surface-300 px-2 py-0.5 font-mono text-xs text-gray-500 hover:bg-surface-400 transition-colors"
            >
              Show less <ChevronUp className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function WalletNFTHoldings() {
  const { isConnected } = useAccount();
  const {
    data: collections,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useWalletNFTs();

  if (!isConnected) return null;

  const totalTokens = collections?.reduce((a, c) => a + c.tokenIds.length, 0) ?? 0;

  return (
    /* Removed grey container border & background block in light theme */
    <div className="rounded-2xl border border-transparent dark:border-surface-300 bg-transparent dark:bg-surface-100 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-surface-300 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Your NFT Holdings</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isLoading
              ? "Fetching NFTs from blockchain..."
              : isError
                ? "Failed to load NFTs"
                : collections && collections.length > 0
                  ? `${collections.length} collection${collections.length !== 1 ? "s" : ""} · ${totalTokens} total token${totalTokens !== 1 ? "s" : ""}`
                  : "No NFTs found in this wallet"}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-300 hover:text-gray-300 transition-colors disabled:opacity-50"
          title="Refresh NFTs"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="p-4">

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-surface-200 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-sm text-gray-400">Could not load NFT data</p>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded-lg border border-surface-400 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-surface-500 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && (!collections || collections.length === 0) && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-200">
              <ImageIcon className="h-6 w-6 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500">No NFTs found in this wallet</p>
            <p className="mt-1 text-xs text-gray-600">NFTs you own will appear here</p>
          </div>
        )}

        {/* Collections list */}
        {!isLoading && !isError && collections && collections.length > 0 && (
          <div className="space-y-3">
            {collections.map((col) => (
              <NFTCollectionRow
                key={col.contractAddress}
                name={col.name}
                symbol={col.symbol}
                contractAddress={col.contractAddress}
                standard={col.standard}
                tokenIds={col.tokenIds}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}