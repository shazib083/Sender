"use client";
import { useEffect, useState } from "react";
import {
  Zap, Info, TrendingUp, Download,
  ShieldCheck, PenLine, Send,
  CheckCircle2, Loader2,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useBatchStore } from "@/lib/store/batch-store";
import { useBatchExecution, type BatchPhase } from "@/lib/hooks/use-batch-execution";
import { usePermit2Setup } from "@/lib/hooks/use-permit2-setup";
import { useTokenBalances } from "@/lib/hooks/use-token-balances";
import { Button } from "@/components/ui/button";
import { TokenLogo } from "@/components/ui/token-logo";
import { cn } from "@/components/ui/utils";
import { TOKEN_REGISTRY, formatTokenAmount } from "@/lib/blockchain/tokens";
import { computeFeeWei, getFeeLabel } from "@/lib/blockchain/multisend";
import { exportTransactionReport } from "@/lib/utils/csv";
import type { TokenSymbol } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ── Phase steps ───────────────────────────────────────────────
const STEPS: { phase: BatchPhase; label: string; sub: string; icon: React.ElementType }[] = [
  {
    phase: "signing",
    label: "Sign permit",
    sub:   "Gasless — covers all tokens, no gas fee",
    icon:  PenLine,
  },
  {
    phase: "sending",
    label: "Send batch",
    sub:   "One tx — permit + all transfers together",
    icon:  Send,
  },
];

function PhaseSteps({ phase }: { phase: BatchPhase }) {
  if (!["signing", "sending"].includes(phase)) return null;
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

// ── Setup banner ──────────────────────────────────────────────
function SetupBanner({ status, tokensRemaining }: { status: string; tokensRemaining: number }) {
  if (status === "done" || status === "idle") return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/8 px-4 py-3">
      <Loader2 className="h-4 w-4 shrink-0 text-yellow-400 animate-spin" />
      <p className="text-xs text-yellow-300 leading-relaxed">
        {status === "checking"
          ? "Checking Permit2 approvals…"
          : `One-time setup: ${tokensRemaining} token${tokensRemaining > 1 ? "s" : ""} remaining…`}
      </p>
    </div>
  );
}

// ── Permit2 banner ────────────────────────────────────────────
function Permit2Banner({ tokenCount, setupDone }: { tokenCount: number; setupDone: boolean }) {
  if (tokenCount === 0) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/8 px-4 py-3">
      <ShieldCheck className="h-4 w-4 shrink-0 text-brand-400 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-brand-300">Powered by Permit2</p>
        <p className="text-xs text-brand-400/80 leading-relaxed">
          {setupDone
            ? "1 signature + 1 transaction — all tokens, all recipients."
            : "Completing one-time Permit2 setup…"}
        </p>
      </div>
    </div>
  );
}

// ── Button label ──────────────────────────────────────────────
function ButtonLabel({ phase, isExecuting, setupDone }: {
  phase: BatchPhase; isExecuting: boolean; setupDone: boolean;
}) {
  if (!setupDone)           return <><Zap className="h-4 w-4" />Setup in Progress…</>;
  if (!isExecuting)         return <><Zap className="h-4 w-4" />Execute Batch</>;
  if (phase === "validating") return <>Validating…</>;
  if (phase === "signing")    return <><PenLine className="h-4 w-4 animate-pulse" />Waiting for signature…</>;
  if (phase === "sending")    return <><Send className="h-4 w-4 animate-pulse" />Sending batch…</>;
  return <>Working…</>;
}

// ── Main SummaryPanel ─────────────────────────────────────────
export function SummaryPanel() {
  const { rows, batchStatus, getSummary } = useBatchStore();
  const { isConnected }                  = useAccount();
  const { execute, isExecuting, batchPhase, estimateGas } = useBatchExecution();
  const { status: setupStatus, tokensRemaining }           = usePermit2Setup();
  const { data: balances }                                 = useTokenBalances();
  const [gasEst, setGasEst]                               = useState<bigint | null>(null);
  const [batchId]                                         = useState(() => uuidv4());

  const summary     = getSummary();
  const validRows   = rows.filter((r) => r.address && r.amount);
  const hasSentRows = rows.some((r) => r.status === "success" || r.status === "failed");
  const tokenCount  = new Set(validRows.map((r) => r.tokenSymbol)).size;
  const setupDone   = setupStatus === "done";

  // Fee for current batch
  const feeLabel = getFeeLabel(validRows.length);
  const feeWei   = computeFeeWei(validRows.length);

  useEffect(() => {
    if (validRows.length === 0) { setGasEst(null); return; }
    const t = setTimeout(async () => { setGasEst(await estimateGas()); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validRows.length]);

  const summaryEntries = Object.entries(summary.totalByToken) as [TokenSymbol, bigint][];

  const insufficientTokens = summaryEntries.filter(
    ([sym, amt]) => amt > (balances?.map[sym]?.balance ?? 0n)
  );

  const canExecute =
    isConnected &&
    !isExecuting &&
    setupDone &&
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
        {gasEst !== null && gasEst > 0n && (
          <div className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <TrendingUp className="h-3.5 w-3.5" /> Est. Gas
            </span>
            <span className="text-sm font-mono text-gray-300">
              {gasEst.toLocaleString()} units
            </span>
          </div>
        )}

        {/* Setup banner */}
        <SetupBanner status={setupStatus} tokensRemaining={tokensRemaining} />

        {/* Permit2 banner */}
        {!isExecuting && validRows.length > 0 && (
          <Permit2Banner tokenCount={tokenCount} setupDone={setupDone} />
        )}

        {/* Phase tracker */}
        <PhaseSteps phase={batchPhase} />

        {/* Execute button */}
        <Button
          variant="gradient"
          size="lg"
          className="w-full mt-2"
          loading={isExecuting || ["checking", "approving"].includes(setupStatus)}
          disabled={!canExecute}
          onClick={() => execute()}
        >
          <ButtonLabel phase={batchPhase} isExecuting={isExecuting} setupDone={setupDone} />
        </Button>

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