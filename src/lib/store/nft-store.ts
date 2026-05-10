// ============================================================
// lib/store/nft-store.ts
// Zustand store for NFT bulk send state
// SSR-safe: localStorage only accessed in browser
// ============================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { NftRecipientRow, NftRowStatus, NftBatchStatus, NftBatchSummary } from "@/types/nft";

// ---- SSR-safe storage (mirrors batch-store.ts pattern) ----
const safeStorage = () => {
  if (typeof window === "undefined") {
    return {
      getItem: (_key: string) => null,
      setItem: (_key: string, _value: string) => {},
      removeItem: (_key: string) => {},
      length: 0,
      clear: () => {},
      key: (_index: number) => null,
    } as Storage;
  }
  return localStorage;
};

function emptyNftRow(): NftRecipientRow {
  return {
    id: uuidv4(),
    contractAddress: "",
    tokenId: "",
    amount: "1",
    standard: "ERC721",
    recipientAddress: "",
    status: "idle",
  };
}

// ---- Store interface ----
interface NftStore {
  rows: NftRecipientRow[];
  addRow: () => void;
  updateRow: (id: string, updates: Partial<NftRecipientRow>) => void;
  removeRow: (id: string) => void;
  clearRows: () => void;
  importRows: (rows: Omit<NftRecipientRow, "id" | "status">[]) => void;
  setRowStatus: (
    id: string,
    status: NftRowStatus,
    txHash?: string,
    errorMessage?: string
  ) => void;
  batchStatus: NftBatchStatus;
  setBatchStatus: (status: NftBatchStatus) => void;
  getSummary: () => NftBatchSummary;
}

export const useNftStore = create<NftStore>()(
  persist(
    (set, get) => ({
      rows: [emptyNftRow()],
      batchStatus: "draft",

      addRow: () =>
        set((state) => ({ rows: [...state.rows, emptyNftRow()] })),

      updateRow: (id, updates) =>
        set((state) => ({
          rows: state.rows.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      removeRow: (id) =>
        set((state) => {
          const filtered = state.rows.filter((r) => r.id !== id);
          return { rows: filtered.length > 0 ? filtered : [emptyNftRow()] };
        }),

      clearRows: () => set({ rows: [emptyNftRow()], batchStatus: "draft" }),

      importRows: (importedRows) =>
        set({
          rows: importedRows.map((r) => ({
            ...r,
            id: uuidv4(),
            status: "idle" as NftRowStatus,
          })),
          batchStatus: "draft",
        }),

      setRowStatus: (id, status, txHash, errorMessage) =>
        set((state) => ({
          rows: state.rows.map((r) =>
            r.id === id ? { ...r, status, txHash, errorMessage } : r
          ),
        })),

      setBatchStatus: (status) => set({ batchStatus: status }),

      getSummary: () => {
        const { rows } = get();
        const totalByContract: Record<string, number> = {};
        let recipientCount = 0;

        for (const row of rows) {
          if (!row.contractAddress || !row.tokenId || !row.recipientAddress) continue;
          const key = row.contractAddress.toLowerCase();
          totalByContract[key] = (totalByContract[key] ?? 0) + 1;
          recipientCount++;
        }

        return { totalByContract, recipientCount };
      },
    }),
    {
      name: "rialo-nft-store",
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({ rows: state.rows }),
    }
  )
);