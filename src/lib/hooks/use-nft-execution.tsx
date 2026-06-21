// ============================================================
// lib/hooks/use-nft-execution.tsx
// Hook to drive the NFT batch send flow
// ============================================================

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { useNftStore } from "@/lib/store/nft-store";
import { validateNftBatch, executeNftBatch } from "@/lib/blockchain/nft";
import { getExplorerTxUrl } from "@/lib/blockchain/provider";
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

  const onProgress = useCallback(
    (rowId: string, status: NftRowStatus, txHash?: string) => {
      setRowStatus(rowId, status, txHash);
    },
    [setRowStatus]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Wallet not connected");

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

      setNftPhase("done");
      setBatchStatus("done");
      return result;
    },

    onSuccess: (result) => {
      const count = result.txHashes.length;
      if (count === 1) {
        const url = getExplorerTxUrl(result.txHashes[0]);
        toast.success(
          <span>
            NFTs sent!{" "}
            <a href={url} target="_blank" rel="noopener" className="underline">
              View tx
            </a>
          </span>,
          { duration: 8000 }
        );
      } else {
        toast.success(`NFT batch complete! ${count} transaction(s) sent.`, {
          duration: 8000,
        });
      }
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
  };
}