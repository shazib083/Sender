// ============================================================
// lib/store/batch-store.ts
// Zustand store: recipients, history, address book
// SSR-safe: localStorage only accessed in browser
// ============================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
  RecipientRow,
  TokenSymbol,
  RowStatus,
  BatchStatus,
  BatchSummary,
  AddressBookEntry,
  TransactionRecord,
} from "@/types";
import { TOKEN_REGISTRY, parseTokenAmount } from "@/lib/blockchain/tokens";

// ---- SSR-safe storage ----
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

// ---- Batch Store ----
interface BatchStore {
  rows: RecipientRow[];
  addRow: () => void;
  updateRow: (id: string, updates: Partial<RecipientRow>) => void;
  removeRow: (id: string) => void;
  clearRows: () => void;
  importRows: (rows: Omit<RecipientRow, "id" | "status">[]) => void;
  setRowStatus: (
    id: string,
    status: RowStatus,
    txHash?: string,
    errorMessage?: string
  ) => void;
  batchStatus: BatchStatus;
  setBatchStatus: (status: BatchStatus) => void;
  getSummary: () => BatchSummary;
  selectedToken: TokenSymbol;
  setSelectedToken: (token: TokenSymbol) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

function emptyRow(): RecipientRow {
  return {
    id: uuidv4(),
    address: "",
    amount: "",
    tokenSymbol: "USDC",
    status: "idle",
  };
}

export const useBatchStore = create<BatchStore>()(
  persist(
    (set, get) => ({
      rows: [emptyRow()],
      batchStatus: "draft",
      selectedToken: "USDC",
      theme: "dark",

      addRow: () =>
        set((state) => ({ rows: [...state.rows, emptyRow()] })),

      updateRow: (id, updates) =>
        set((state) => ({
          rows: state.rows.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      removeRow: (id) =>
        set((state) => {
          const filtered = state.rows.filter((r) => r.id !== id);
          return { rows: filtered.length > 0 ? filtered : [emptyRow()] };
        }),

      clearRows: () => set({ rows: [emptyRow()], batchStatus: "draft" }),

      importRows: (importedRows) =>
        set({
          rows: importedRows.map((r) => ({
            ...r,
            id: uuidv4(),
            status: "idle" as RowStatus,
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
        const totalByToken = {} as Record<TokenSymbol, bigint>;
        for (const row of rows) {
          if (!row.amount || !row.address) continue;
          const token = TOKEN_REGISTRY[row.tokenSymbol];
          const amount = parseTokenAmount(row.amount, token.decimals);
          totalByToken[row.tokenSymbol] =
            (totalByToken[row.tokenSymbol] ?? BigInt(0)) + amount;
        }
        return {
          totalByToken,
          recipientCount: rows.filter((r) => r.address && r.amount).length,
        };
      },

      setSelectedToken: (token) => set({ selectedToken: token }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    }),
    {
      name: "rialo-batch-store",
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({
        rows: state.rows,
        selectedToken: state.selectedToken,
        theme: state.theme,
      }),
    }
  )
);

// ---- Address Book Store ----
interface AddressBookStore {
  entries: AddressBookEntry[];
  addEntry: (label: string, address: string) => void;
  removeEntry: (id: string) => void;
  findEntry: (address: string) => AddressBookEntry | undefined;
}

export const useAddressBookStore = create<AddressBookStore>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (label, address) =>
        set((s) => ({
          entries: [
            ...s.entries,
            { id: uuidv4(), label, address, createdAt: new Date() },
          ],
        })),
      removeEntry: (id) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.id !== id),
        })),
      findEntry: (address) =>
        get().entries.find(
          (e) => e.address.toLowerCase() === address.toLowerCase()
        ),
    }),
    {
      name: "rialo-address-book",
      storage: createJSONStorage(safeStorage),
    }
  )
);

// ---- History Store ----
interface HistoryStore {
  records: TransactionRecord[];
  addRecord: (record: TransactionRecord) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (record) =>
        set((s) => ({
          records: [record, ...s.records].slice(0, 500),
        })),
      clearHistory: () => set({ records: [] }),
    }),
    {
      name: "rialo-history",
      storage: createJSONStorage(safeStorage),
    }
  )
);