// ============================================================
// lib/hooks/use-batch-execution.ts
// Hook to drive the batch send flow
// ============================================================

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { useBatchStore, useHistoryStore } from "@/lib/store/batch-store";
import { validateBatch, executeBatch, estimateBatchGas } from "@/lib/blockchain/multisend";
import { useBalanceMap } from "./use-token-balances";
import { formatTokenAmount, TOKEN_REGISTRY } from "@/lib/blockchain/tokens";
import { getExplorerTxUrl } from "@/lib/blockchain/provider";
import type { RecipientRow, RowStatus, TokenSymbol } from "@/types";

export function useBatchExecution() {
  const { address } = useAccount();
  const { rows, setBatchStatus, setRowStatus, getSummary } = useBatchStore();
  const addRecord = useHistoryStore((s) => s.addRecord);
  const balances = useBalanceMap();

  const onProgress = useCallback(
    (rowId: string, status: RowStatus, txHash?: string) => {
      setRowStatus(rowId, status, txHash);
    },
    [setRowStatus]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Wallet not connected");

      const validRows = rows.filter((r) => r.address && r.amount);
      if (validRows.length === 0) throw new Error("No valid recipients");

      // --- Validate ---
      setBatchStatus("simulating");
      const validation = await validateBatch(validRows, address, balances);
      if (!validation.valid) {
        for (const [rowId, msg] of Object.entries(validation.errors)) {
          setRowStatus(rowId, "invalid", undefined, msg);
        }
        throw new Error("Validation failed. Check highlighted rows.");
      }

      // --- Execute ---
      setBatchStatus("executing");
      const result = await executeBatch(validRows, onProgress);

      // --- Record in history ---
      const summary = getSummary();
      const totalByToken: Record<string, string> = {};
      for (const [sym, amount] of Object.entries(summary.totalByToken)) {
        const token = TOKEN_REGISTRY[sym as TokenSymbol];
        totalByToken[sym] = formatTokenAmount(amount as bigint, token.decimals);
      }

      addRecord({
        id: uuidv4(),
        batchId: uuidv4(),
        txHash: result.txHash,
        status: "confirmed",
        recipientCount: validRows.length,
        totalByToken,
        timestamp: new Date(),
        networkName: "Arc Testnet",
        from: address,
      });

      setBatchStatus("done");
      return result;
    },
    onSuccess: (result) => {
      const url = getExplorerTxUrl(result.txHash);
      toast.success(
        <span>
          Batch sent!{" "}
          <a href={url} target="_blank" rel="noopener" className="underline">
            View tx
          </a>
        </span>,
        { duration: 8000 }
      );
    },
    onError: (err: Error) => {
      setBatchStatus("failed");
      toast.error(err.message ?? "Batch execution failed");
    },
  });

  const estimateGas = useCallback(async () => {
    const validRows = rows.filter((r) => r.address && r.amount);
    return estimateBatchGas(validRows);
  }, [rows]);

  return {
    execute: mutation.mutate,
    isExecuting: mutation.isPending,
    error: mutation.error,
    estimateGas,
  };
}
