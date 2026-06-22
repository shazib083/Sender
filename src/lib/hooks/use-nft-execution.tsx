// ============================================================
// lib/hooks/use-nft-execution.tsx
// Hook to drive the NFT batch send flow.
//
// On success we expose `lastTxHash` so the NFT Summary panel can render an
// inline "Batch sent! View tx" banner (between Execute and Export) instead of a
// bottom-right toast. History is read live from Blockscout on the History tab.
// ============================================================

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { useNftStore } from "@/lib/store/nft-store";
import { validateNftBatch, executeNftBatch } from "@/lib/blockchain/nft";
import type { NftRowStatus } from "@/types/nft";

// Two on-chain wallet popups per batch, in order — mirrors BatchPhase for tokens:
//   "approving" — Popup 1: setApprovalForAll for the NFT collection(s)
//   "sending"   — Popup 2: multisend transfer to all recipients
export type NftPhase =
  | "idle"
  | "validating"
  | "approving"
  | "sending"
  | "done"
  | "failed";

export function useNftExecution() {
  const { address } = useAccount();
  const { rows, setBatchStatus, setRowStatus } = useNftStore();
  const [nftPhase, setNftPhase] = useState<NftPhase>("idle");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const onProgress = useCallback(
    (rowId: string, status: NftRowStatus, txHash?: string) => {
      setRowStatus(rowId, status, txHash);
    },
    [setRowStatus]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Wallet not connected");
      setLastTxHash(null);

      const validRows = rows.filter(
        (r) => r.contractAddress && r.tokenId && r.recipientAddress
      );
      if (validRows.length === 0) throw new Error("No valid NFT rows to send");
      if (validRows.length > 200) throw new Error("Maximum batch size is 200");

      // --- Validate ---
      setNftPhase("validating");
      setBatchStatus("simulating");
      const validation = await validateNftBatch(validRows, address);

      if (!validation.valid) {
        for (const [rowId, msg] of Object.entries(validation.errors)) {
          setRowStatus(rowId, "invalid", undefined, msg);
        }
        throw new Error("Validation failed. Check highlighted rows.");
      }

      // --- Execute: Popup 1 (approve) → Popup 2 (transfer) ---
      setNftPhase("approving");
      setBatchStatus("executing");
      const result = await executeNftBatch(validRows, onProgress, (phase) => {
        setNftPhase(phase);
        setBatchStatus("executing");
      });

      if (result.txHashes.length > 0) {
        setLastTxHash(result.txHashes[result.txHashes.length - 1]);
      }
      setNftPhase("done");
      setBatchStatus("done");
      return result;
    },

    onError: (err: Error) => {
      setNftPhase("failed");
      setBatchStatus("failed");
      toast.error(err.message ?? "NFT batch execution failed");
    },
  });

  return {
    execute: mutation.mutate,
    isExecuting: mutation.isPending,
    error: mutation.error,
    nftPhase,
    lastTxHash,
  };
}
