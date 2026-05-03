"use client";
import { useEffect, useState } from "react";
import { Zap, Info, TrendingUp, Download } from "lucide-react";
import { useAccount } from "wagmi";
import { useBatchStore } from "@/lib/store/batch-store";
import { useBatchExecution } from "@/lib/hooks/use-batch-execution";
import { useTokenBalances } from "@/lib/hooks/use-token-balances";
import { Button } from "@/components/ui/button";
import { TokenLogo } from "@/components/ui/token-logo";
import { cn } from "@/components/ui/utils";
import { TOKEN_REGISTRY, formatTokenAmount } from "@/lib/blockchain/tokens";
import { exportTransactionReport } from "@/lib/utils/csv";
import type { TokenSymbol } from "@/types";
import { v4 as uuidv4 } from "uuid";

export function SummaryPanel() {
  const { rows, batchStatus, getSummary } = useBatchStore();
  const { isConnected } = useAccount();
  const { execute, isExecuting, estimateGas } = useBatchExecution();
  const { data: balances } = useTokenBalances();
  const [gasEst, setGasEst] = useState<bigint | null>(null);
  const [batchId] = useState(() => uuidv4());

  const summary = getSummary();
  const validRows = rows.filter((r) => r.address && r.amount);
  const isDone = batchStatus === "done";
  const hasSentRows = rows.some((r) => r.status === "success" || r.status === "failed");

  // Gas estimation (debounced)
  useEffect(() => {
    if (validRows.length === 0) {
      setGasEst(null);
      return;
    }
    const t = setTimeout(async () => {
      const gas = await estimateGas();
      setGasEst(gas);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validRows.length]);

  const summaryEntries = Object.entries(summary.totalByToken) as [TokenSymbol, bigint][];
  const isEmpty = summaryEntries.length === 0;

  // Check if any token exceeds balance
  const insufficientTokens = summaryEntries.filter(([sym, amt]) => {
    const bal = balances?.map[sym]?.balance ?? 0n;
    return amt > bal;
  });

  const canExecute =
    isConnected &&
    !isExecuting &&
    validRows.length > 0 &&
    insufficientTokens.length === 0 &&
    batchStatus !== "executing";

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="border-b border-surface-300 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Summary</h2>
      </div>

      <div className="p-5 space-y-3">
        {/* Token totals */}
        {isEmpty ? (
          <div className="rounded-xl bg-surface-200 p-4 text-center text-sm text-gray-500">
            Add recipients to see a summary
          </div>
        ) : (
          summaryEntries.map(([sym, amt]) => {
            const token = TOKEN_REGISTRY[sym];
            const formatted = formatTokenAmount(amt, token.decimals);
            const bal = balances?.map[sym]?.balance ?? 0n;
            const insufficient = amt > bal;

            return (
              <div
                key={sym}
                className={cn(
                  "rounded-xl p-4 border",
                  insufficient
                    ? "border-red-500/30 bg-red-500/10"
                    : "border-surface-300 bg-surface-200"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider">
                    <TokenLogo symbol={sym} size={14} />
                    {sym} Total
                  </div>
                  {insufficient && (
                    <span className="text-xs text-red-400 flex items-center gap-1">
                      <Info className="h-3 w-3" /> Insufficient
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">{formatted}</p>
                {isConnected && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Balance: {formatTokenAmount(bal, token.decimals)} {sym}
                  </p>
                )}
              </div>
            );
          })
        )}

        {/* Recipients count */}
        {validRows.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
            <span className="text-sm text-gray-400">Recipients</span>
            <span className="text-sm font-semibold text-white">{summary.recipientCount}</span>
          </div>
        )}

        {/* Gas estimate */}
        {gasEst !== null && gasEst > 0n && (
          <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <TrendingUp className="h-3.5 w-3.5" /> Est. Gas
            </span>
            <span className="text-sm font-mono text-gray-300">{gasEst.toLocaleString()} units</span>
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
            "Sending Batch..."
          ) : batchStatus === "simulating" ? (
            "Validating..."
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Execute Batch
            </>
          )}
        </Button>

        {/* Export report */}
        {hasSentRows && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => exportTransactionReport(rows, batchId)}
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
