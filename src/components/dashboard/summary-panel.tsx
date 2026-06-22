"use client";
import { useEffect, useState } from "react";
import {
  Zap, Info, TrendingUp, Download,
  ShieldCheck, CheckCheck, Send,
  CheckCircle2, Loader2, ExternalLink,
} from "lucide-react";
import { getExplorerTxUrl } from "@/lib/blockchain/provider";
import { useAccount, usePublicClient } from "wagmi";
import { useBatchStore } from "@/lib/store/batch-store";
import { useBatchExecution, type BatchPhase } from "@/lib/hooks/use-batch-execution";
import { useTokenBalances } from "@/lib/hooks/use-token-balances";
import { Button } from "@/components/ui/button";
import { TokenLogo } from "@/components/ui/token-logo";
import { cn } from "@/components/ui/utils";
import { TOKEN_REGISTRY, formatTokenAmount } from "@/lib/blockchain/tokens";
import { computeFeeWei, getFeeLabel } from "@/lib/blockchain/multisend";
import { exportTransactionReport } from "@/lib/utils/csv";
import type { TokenSymbol } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ── Phase steps ───────────────────────────────────────────────────────
// The two on-chain wallet popups, in order.
const STEPS: { phase: BatchPhase; label: string; sub: string; icon: React.ElementType }[] = [
  {
    phase: "approving",
    label: "Approve tokens",
    sub:   "Approve exact amounts for all tokens (Multicall3From)",
    icon:  CheckCheck,
  },
  {
    phase: "sending",
    label: "Send batch",
    sub:   "Distribute tokens to all recipients",
    icon:  Send,
  },
];

function PhaseSteps({ phase }: { phase: BatchPhase }) {
  if (!["approving", "sending"].includes(phase)) return null;
  const activeIdx = STEPS.findIndex((s) => s.phase === phase);

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        In progress
      </p>
      {STEPS.map((step, idx) => {
        const done    = idx < activeIdx;
        const current = idx === activeIdx;
        const waiting = idx > activeIdx;
        const Icon    = step.icon;
        return (
          <div key={step.phase} className="flex items-start gap-3">
            <div className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all",
              done    && "border-emerald-500 bg-emerald-500/20 text-emerald-400",
              current && "border-brand-500  bg-brand-500/20  text-brand-400",
              waiting && "border-surface-400 bg-surface-300  text-gray-600",
            )}>
              {done    ? <CheckCircle2 className="h-3 w-3" /> :
               current ? <Loader2 className="h-3 w-3 animate-spin" /> :
               <Icon className="h-3 w-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium leading-tight",
                done    && "text-emerald-400",
                current && "text-white",
                waiting && "text-gray-600",
              )}>
                {step.label}
              </p>
              {current && (
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{step.sub}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Auth model banner ─────────────────────────────────────────────────
// Explains the 2-step, exact-allowance flow (no Permit2, no unlimited approval).
function AuthBanner({ tokenCount }: { tokenCount: number }) {
  if (tokenCount === 0) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/8 px-4 py-3">
      <ShieldCheck className="h-4 w-4 shrink-0 text-brand-400 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-brand-300">Secure 2-step send</p>
        <p className="text-xs text-brand-400/80 leading-relaxed">
          1 Approve + 1 Transfer
        </p>
      </div>
    </div>
  );
}

// ── Button label ──────────────────────────────────────────────────────
function ButtonLabel({ phase, isExecuting }: {
  phase: BatchPhase; isExecuting: boolean;
}) {
  if (!isExecuting)           return <><Zap className="h-4 w-4" />Execute Batch</>;
  if (phase === "validating") return <>Validating…</>;
  if (phase === "approving")  return <><CheckCheck className="h-4 w-4 animate-pulse" />Waiting for approval…</>;
  if (phase === "sending")    return <><Send className="h-4 w-4 animate-pulse" />Sending batch…</>;
  return <>Working…</>;
}

// ── Main SummaryPanel ─────────────────────────────────────────────────
export function SummaryPanel() {
  const { rows, batchStatus, getSummary } = useBatchStore();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { execute, isExecuting, batchPhase, lastTxHash } = useBatchExecution();
  const { data: balances } = useTokenBalances();
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [batchId] = useState(() => uuidv4());

  const summary     = getSummary();
  const validRows   = rows.filter((r) => r.address && r.amount);
  const hasSentRows = rows.some((r) => r.status === "success" || r.status === "failed");
  const tokenCount  = new Set(validRows.map((r) => r.tokenSymbol)).size;

  // Fee for current batch
  const feeLabel = getFeeLabel(validRows.length);
  const feeWei   = computeFeeWei(validRows.length);

  useEffect(() => {
    if (validRows.length === 0 || !publicClient) {
      setGasPrice(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        // Latest block fee data
        const feeHistory = await publicClient.request({
          method: "eth_feeHistory",
          params: ["0x1", "latest", [50]],
        });

        const baseFee = BigInt(
          feeHistory.baseFeePerGas[
            feeHistory.baseFeePerGas.length - 1
          ]
        );

        // Safely access multi-dimensional array with optional chaining and fallback
        const priorityFee = BigInt(feeHistory.reward?.[0]?.[0] ?? 0);

        // recommended gas price
        setGasPrice(baseFee + priorityFee);
        const recommended = ((baseFee + priorityFee) * 120n) / 100n;
        setGasPrice(recommended);
      } catch (error) {
        try {
          // fallback
          const price = await publicClient.getGasPrice();
          setGasPrice(price);
        } catch {
          setGasPrice(null);
        }
      }
    }, 800);

    return () => clearTimeout(t);
  }, [validRows.length, publicClient]);

  const summaryEntries = Object.entries(summary.totalByToken) as [TokenSymbol, bigint][];

  const insufficientTokens = summaryEntries.filter(
    ([sym, amt]) => amt > (balances?.map[sym]?.balance ?? 0n)
  );

  const canExecute =
    isConnected &&
    !isExecuting &&
    validRows.length > 0 &&
    insufficientTokens.length === 0 &&
    !["executing", "approving"].includes(batchStatus ?? "");

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="border-b border-surface-300 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Summary
        </h2>
      </div>

      <div className="p-5 space-y-3">
        {/* Token totals */}
        {summaryEntries.length === 0 ? (
          <div className="rounded-xl bg-surface-200 p-4 text-center text-sm text-gray-500">
            Add recipients to see a summary
          </div>
        ) : (
          summaryEntries.map(([sym, amt]) => {
            const token        = TOKEN_REGISTRY[sym];
            const bal          = balances?.map[sym]?.balance ?? 0n;
            const insufficient = amt > bal;
            return (
              <div key={sym} className={cn(
                "rounded-xl p-4 border",
                insufficient ? "border-red-500/30 bg-red-500/10" : "border-surface-300 bg-surface-200"
              )}>
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
                <p className="text-2xl font-bold text-white tabular-nums">
                  {formatTokenAmount(amt, token.decimals)}
                </p>
                {isConnected && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Balance: {formatTokenAmount(bal, token.decimals)} {sym}
                  </p>
                )}
              </div>
            );
          })
        )}

        {/* Recipient count */}
        {validRows.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
            <span className="text-sm text-gray-400">Recipients</span>
            <span className="text-sm font-semibold text-white">{summary.recipientCount}</span>
          </div>
        )}

        {/* Protocol fee */}
        {validRows.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
            <span className="text-sm text-gray-400">Protocol Fee</span>
            <span className={cn(
              "text-sm font-semibold",
              feeWei === 0n ? "text-emerald-400" : "text-white"
            )}>
              {feeLabel}
            </span>
          </div>
        )}

        {/* Gas estimate */}
        {gasPrice !== null && (
          <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <TrendingUp className="h-3.5 w-3.5" />
              Est. Gas
            </span>
            <span className="text-sm font-mono text-gray-300">
              {(Number(gasPrice) / 1e9).toFixed(1)} Gwei
            </span>
          </div>
        )}

        {/* Auth model banner */}
        {!isExecuting && validRows.length > 0 && (
          <AuthBanner tokenCount={tokenCount} />
        )}

        {/* Phase tracker */}
        <PhaseSteps phase={batchPhase} />

        {/* Execute button */}
        <Button
          variant="gradient"
          size="lg"
          className="w-full mt-2"
          loading={isExecuting}
          disabled={!canExecute}
          onClick={() => execute()}
        >
          <ButtonLabel phase={batchPhase} isExecuting={isExecuting} />
        </Button>

        {/* Inline success banner — sits between Execute and Export */}
        {batchPhase === "done" && lastTxHash && (
          <a
            href={getExplorerTxUrl(lastTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Batch sent! View tx
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {/* Export */}
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
