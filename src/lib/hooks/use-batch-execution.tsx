// ============================================================
// lib/hooks/use-batch-execution.tsx
//
// Exactly 2 wallet interactions per batch:
//   "approving" — Popup 1: Multicall3From batch-approve (exact amounts)
//   "sending"   — Popup 2: multisendMultiToken (pull-then-push + native USDC)
//
// On success we expose `lastTxHash` so the Summary panel can render an inline
// "Batch sent! View tx" banner (between Execute and Export) instead of a
// bottom-right toast. Nothing is written to localStorage — transaction history
// is read live from Blockscout on the History tab.
// ============================================================

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { useBatchStore } from "@/lib/store/batch-store";
import { validateBatch, executeBatch, estimateBatchGas } from "@/lib/blockchain/multisend";
import { useBalanceMap } from "./use-token-balances";
import type { RowStatus } from "@/types";

export type BatchPhase =
  | "idle"
  | "validating"
  | "approving" // Popup 1: Multicall3From batch approve (exact amounts)
  | "sending"   // Popup 2: multisendMultiToken — pull-then-push + native USDC
  | "done"
  | "failed";

export function useBatchExecution() {
  const { address } = useAccount();
  const { rows, setBatchStatus, setRowStatus } = useBatchStore();
  const balances  = useBalanceMap();
  const [batchPhase, setBatchPhase] = useState<BatchPhase>("idle");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const onProgress = useCallback(
    (rowId: string, status: RowStatus, txHash?: string) => {
      setRowStatus(rowId, status, txHash);
    },
    [setRowStatus]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Wallet not connected");
      setLastTxHash(null);

      const validRows = rows.filter((r) => r.address && r.amount);
      if (validRows.length === 0) throw new Error("No valid recipients");

      // ── Validate ───────────────────────────────────────────────────────────
      setBatchPhase("validating");
      setBatchStatus("simulating");

      const validation = await validateBatch(validRows, address, balances);
      if (!validation.valid) {
        for (const [rowId, msg] of Object.entries(validation.errors)) {
          setRowStatus(rowId, "invalid", undefined, msg);
        }
        throw new Error("Validation failed. Check highlighted rows.");
      }

      // ── Popup 1: approve, Popup 2: send ─────────────────────────────────────
      setBatchPhase("approving");
      setBatchStatus("approving");

      const result = await executeBatch(
        validRows,
        onProgress,
        (phase) => {
          setBatchPhase(phase);
          setBatchStatus(phase === "approving" ? "approving" : "executing");
        }
      );

      setLastTxHash(result.txHash);
      setBatchPhase("done");
      setBatchStatus("done");
      return result;
    },

    onError: (err: Error) => {
      setBatchPhase("failed");
      setBatchStatus("failed");
      toast.error(err.message ?? "Batch execution failed");
    },
  });

  const estimateGas = useCallback(async () => {
    return estimateBatchGas(rows.filter((r) => r.address && r.amount));
  }, [rows]);

  return {
    execute:     mutation.mutate,
    isExecuting: mutation.isPending,
    error:       mutation.error,
    batchPhase,
    estimateGas,
    lastTxHash,
  };
}
