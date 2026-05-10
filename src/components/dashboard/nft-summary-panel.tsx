"use client";
import { Zap, Download, ImageIcon } from "lucide-react";
import { useAccount } from "wagmi";
import { useNftStore } from "@/lib/store/nft-store";
import { useNftExecution } from "@/lib/hooks/use-nft-execution";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { exportNftTransactionReport } from "@/lib/utils/nft-csv";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";

export function NftSummaryPanel() {
  const { rows, batchStatus, getSummary } = useNftStore();
  const { isConnected } = useAccount();
  const { execute, isExecuting } = useNftExecution();
  const [batchId] = useState(() => uuidv4());

  const summary = getSummary();
  const validRows = rows.filter(
    (r) => r.contractAddress && r.tokenId && r.recipientAddress
  );
  const hasSentRows = rows.some(
    (r) => r.status === "success" || r.status === "failed"
  );
  const isEmpty = summary.recipientCount === 0;

  // Group rows by standard for display
  const erc721Count = validRows.filter((r) => r.standard === "ERC721").length;
  const erc1155Count = validRows.filter((r) => r.standard === "ERC1155").length;
  const uniqueContracts = Object.keys(summary.totalByContract).length;

  const canExecute =
    isConnected &&
    !isExecuting &&
    validRows.length > 0 &&
    batchStatus !== "executing";

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="border-b border-surface-300 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          NFT Summary
        </h2>
      </div>

      <div className="p-5 space-y-3">
        {isEmpty ? (
          <div className="rounded-xl bg-surface-200 p-4 text-center text-sm text-gray-500">
            Add NFT recipients to see a summary
          </div>
        ) : (
          <>
            {/* Total NFTs */}
            <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Total NFTs
                </div>
              </div>
              <p className="text-2xl font-bold text-white tabular-nums">
                {summary.recipientCount}
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-2">
              {erc721Count > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
                  <span className="text-sm text-gray-400">ERC-721</span>
                  <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-xs font-semibold text-brand-300">
                    {erc721Count} token{erc721Count !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {erc1155Count > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
                  <span className="text-sm text-gray-400">ERC-1155</span>
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
                    {erc1155Count} transfer{erc1155Count !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Unique contracts */}
            {uniqueContracts > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
                <span className="text-sm text-gray-400">Contracts</span>
                <span className="text-sm font-semibold text-white">
                  {uniqueContracts}
                </span>
              </div>
            )}

            {/* Recipients */}
            <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
              <span className="text-sm text-gray-400">Recipients</span>
              <span className="text-sm font-semibold text-white">
                {summary.recipientCount}
              </span>
            </div>
          </>
        )}

        {/* Status note */}
        {batchStatus === "simulating" && (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
            Validating ownership…
          </div>
        )}
        {batchStatus === "executing" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Sending NFTs — please keep this tab open…
          </div>
        )}

        {/* Execute button */}
        <Button
          variant="gradient"
          size="lg"
          className="w-full mt-2"
          loading={isExecuting || batchStatus === "simulating"}
          disabled={!canExecute}
          onClick={() => execute()}
        >
          {isExecuting || batchStatus === "executing" ? (
            "Sending NFTs…"
          ) : batchStatus === "simulating" ? (
            "Validating…"
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Execute NFT Batch
            </>
          )}
        </Button>

        {/* Export report */}
        {hasSentRows && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => exportNftTransactionReport(rows, batchId)}
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        )}

        {!isConnected && (
          <p className="text-center text-xs text-gray-500">
            Connect your wallet to execute
          </p>
        )}
      </div>
    </div>
  );
}