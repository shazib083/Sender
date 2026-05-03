"use client";
import { useState } from "react";
import { useHistoryStore } from "@/lib/store/batch-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { truncateAddress } from "@/lib/utils/validation";
import { getExplorerTxUrl } from "@/lib/blockchain/provider";
import { exportTransactionReport } from "@/lib/utils/csv";
import { Trash2, ExternalLink, Download, History, Search } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import type { TxStatus } from "@/types";

const STATUS_VARIANT: Record<TxStatus, "success" | "error" | "warning"> = {
  confirmed: "success",
  failed: "error",
  pending: "warning",
};

export default function HistoryPage() {
  const { records, clearHistory } = useHistoryStore();
  const [search, setSearch] = useState("");

  const filtered = records.filter(
    (r) =>
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
            {records.length} batch{records.length !== 1 ? "es" : ""} executed
          </p>
        </div>
        {records.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              clearHistory();
              toast.success("History cleared");
            }}
          >
            <Trash2 className="h-4 w-4" /> Clear History
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

      {/* Empty state */}
      {records.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-surface-300 bg-surface-100 py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-200">
            <History className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-white">No transactions yet</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Execute a batch transfer from the Dashboard to see it recorded here.
          </p>
        </div>
      )}

      {/* Records list */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          <div className="hidden grid-cols-[1fr_100px_120px_100px_140px_80px] gap-4 border-b border-surface-300 px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 sm:grid">
            <span>Transaction</span>
            <span>Recipients</span>
            <span>Tokens Sent</span>
            <span>Network</span>
            <span>Date</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-surface-300">
            {filtered.map((record) => (
              <div
                key={record.id}
                className="grid gap-4 px-5 py-4 items-center text-sm sm:grid-cols-[1fr_100px_120px_100px_140px_80px] hover:bg-surface-200/50 transition-colors"
              >
                {/* Tx Hash */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[record.status]}>
                      {record.status}
                    </Badge>
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

                {/* Count */}
                <span className="text-gray-300">{record.recipientCount}</span>

                {/* Token totals */}
                <div className="flex flex-col gap-0.5">
                  {Object.entries(record.totalByToken).map(([sym, amt]) => (
                    <span key={sym} className="text-xs text-gray-300 tabular-nums">
                      {Number(amt).toLocaleString(undefined, { maximumFractionDigits: 6 })} {sym}
                    </span>
                  ))}
                </div>

                {/* Network */}
                <span className="text-xs text-gray-500">{record.networkName}</span>

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

      {filtered.length === 0 && search && (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 py-12 text-center text-sm text-gray-500">
          No results for &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
