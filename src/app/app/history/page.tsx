"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { truncateAddress } from "@/lib/utils/validation";
import { getExplorerTxUrl } from "@/lib/blockchain/provider";
import { fetchOnChainHistory, type OnChainBatch } from "@/lib/blockchain/history";
import { ExternalLink, History, Search, RefreshCw, Coins, ImageIcon } from "lucide-react";
import { format } from "date-fns";

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const [search, setSearch] = useState("");

  const {
    data: records = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["onchain-history", address],
    queryFn: ({ signal }) => fetchOnChainHistory(address as string, { signal }),
    enabled: Boolean(isConnected && address),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const filtered = records.filter(
    (r: OnChainBatch) =>
      !search ||
      r.txHash.toLowerCase().includes(search.toLowerCase()) ||
      r.from.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="h-6 w-6 text-brand-400" />
            Transaction History
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isConnected
              ? `${records.length} batch${records.length !== 1 ? "es" : ""} found on-chain (live from Blockscout)`
              : "Connect your wallet to view your on-chain history"}
          </p>
        </div>
        {isConnected && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Search */}
      {records.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tx hash or address…"
            className="w-full rounded-xl border border-surface-400 bg-surface-200 py-2.5 pl-9 pr-4 text-sm text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
          />
        </div>
      )}

      {/* Not connected */}
      {!isConnected && (
        <EmptyState
          title="Wallet not connected"
          subtitle="Connect your wallet to load your batch history directly from the Arc explorer."
        />
      )}

      {/* Loading */}
      {isConnected && isLoading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-surface-300 bg-surface-100 py-24 text-center">
          <RefreshCw className="h-8 w-8 text-brand-400 animate-spin" />
          <p className="mt-4 text-sm text-gray-500">Loading history from Blockscout…</p>
        </div>
      )}

      {/* Error */}
      {isConnected && isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 py-12 text-center text-sm text-red-300">
          {(error as Error)?.message ?? "Failed to load history from Blockscout."}
        </div>
      )}

      {/* Empty */}
      {isConnected && !isLoading && !isError && records.length === 0 && (
        <EmptyState
          title="No transactions yet"
          subtitle="Execute a batch transfer from the Dashboard — it will appear here, read live from the chain."
        />
      )}

      {/* Records list */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          <div className="hidden grid-cols-[1fr_160px_100px_150px_70px] gap-4 border-b border-surface-300 px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 sm:grid">
            <span>Transaction</span>
            <span>Type</span>
            <span>Recipients</span>
            <span>Date</span>
            <span>View</span>
          </div>

          <div className="divide-y divide-surface-300">
            {filtered.map((record) => (
              <div
                key={`${record.txHash}-${record.standard}`}
                className="grid gap-4 px-5 py-4 items-center text-sm sm:grid-cols-[1fr_160px_100px_150px_70px] hover:bg-surface-200/50 transition-colors"
              >
                {/* Tx Hash */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="success">confirmed</Badge>
                    <a
                      href={getExplorerTxUrl(record.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-gray-400 hover:text-brand-400 transition-colors flex items-center gap-1"
                    >
                      {truncateAddress(record.txHash, 8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-xs text-gray-600">
                    From: {truncateAddress(record.from, 6)}
                  </p>
                </div>

                {/* Type / standard */}
                <div className="flex items-center gap-1.5">
                  {record.kind === "Token" ? (
                    <Coins className="h-3.5 w-3.5 text-brand-400" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5 text-brand-400" />
                  )}
                  <span className="text-xs text-gray-300">{record.standard}</span>
                </div>

                {/* Count */}
                <span className="text-gray-300">{record.recipientCount}</span>

                {/* Date */}
                <span className="text-xs text-gray-500">
                  {format(new Date(record.timestamp), "MMM d, yyyy HH:mm")}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <a
                    href={getExplorerTxUrl(record.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-300 hover:text-white transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && search && records.length > 0 && (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 py-12 text-center text-sm text-gray-500">
          No results for &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-surface-300 bg-surface-100 py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-200">
        <History className="h-8 w-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-500 max-w-sm">{subtitle}</p>
    </div>
  );
}
