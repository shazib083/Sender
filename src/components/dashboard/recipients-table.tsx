"use client";
import { useRef, useState } from "react";
import {
  Plus, Trash2, Upload, ClipboardPaste, Download,
  AlertCircle, CheckCircle2, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBatchStore } from "@/lib/store/batch-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TokenSelector } from "@/components/ui/token-selector";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { parseCsv, generateTemplate } from "@/lib/utils/csv";
import { sanitizeCsvInput, isValidEthAddress, sanitizeAmountInput, clampAmountDecimals } from "@/lib/utils/validation";
import { TOKEN_REGISTRY } from "@/lib/blockchain/tokens";
import { CsvPasteModal } from "./csv-paste-modal";
import type { TokenSymbol } from "@/types";
import toast from "react-hot-toast";

const MAX_ROWS = 200;

export function RecipientsTable() {
  const { rows, addRow, updateRow, removeRow, clearRows, importRows } = useBatchStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);

  const handleFileUpload = async (file: File) => {
    const result = await parseCsv(file);
    if (result.rows.length === 0 && result.errors.length > 0) {
      toast.error(`CSV parse errors: ${result.errors.slice(0, 3).join("; ")}`);
      return;
    }
    if (result.rows.length > MAX_ROWS) {
      toast.error(`CSV has ${result.rows.length} rows. Max allowed: ${MAX_ROWS}`);
      return;
    }
    importRows(result.rows);
    toast.success(
      `Imported ${result.rows.length} recipients${result.skipped ? ` (${result.skipped} skipped)` : ""}`
    );
    if (result.errors.length > 0) {
      toast.error(`${result.errors.length} rows had errors and were skipped`, { duration: 6000 });
    }
  };

  const handlePasteCsv = async (raw: string) => {
    const safe = sanitizeCsvInput(raw);
    const result = await parseCsv(safe);
    if (result.rows.length === 0) {
      toast.error("No valid rows found in pasted CSV");
      return;
    }
    if (result.rows.length > MAX_ROWS) {
      toast.error(`CSV has ${result.rows.length} rows. Max allowed: ${MAX_ROWS}`);
      return;
    }
    importRows(result.rows);
    setShowPasteModal(false);
    toast.success(`Imported ${result.rows.length} recipients`);
  };

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-surface-300 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Recipients</h2>
          <p className="text-sm text-gray-500">
            {rows.filter((r) => r.address || r.amount).length} of {MAX_ROWS} max recipients
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowPasteModal(true)}>
            <ClipboardPaste className="h-3.5 w-3.5" /> Paste CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={generateTemplate}>
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              clearRows();
              toast.success("All recipients cleared");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear All
          </Button>
        </div>
      </div>

      {/* Table header */}
      <div className="hidden grid-cols-[1fr_180px_140px_80px] gap-3 px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500 sm:grid">
        <span>Wallet Address</span>
        <span>Amount</span>
        <span>Token</span>
        <span className="text-center">Action</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-surface-300">
        <AnimatePresence initial={false}>
          {rows.map((row, idx) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <RecipientRow
                row={row}
                index={idx}
                onUpdate={(updates) => updateRow(row.id, updates)}
                onRemove={() => removeRow(row.id)}
                isOnlyRow={rows.length === 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add row */}
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
          className="text-brand-400 hover:text-brand-300"
        >
          <Plus className="h-4 w-4" />
          Add Recipient
        </Button>
      </div>

      {/* Paste modal */}
      {showPasteModal && (
        <CsvPasteModal
          onClose={() => setShowPasteModal(false)}
          onSubmit={handlePasteCsv}
        />
      )}
    </div>
  );
}

// ---- Single row ----
interface RecipientRowProps {
  row: ReturnType<typeof useBatchStore.getState>["rows"][0];
  index: number;
  onUpdate: (updates: Partial<typeof row>) => void;
  onRemove: () => void;
  isOnlyRow: boolean;
}

function RecipientRow({ row, index, onUpdate, onRemove, isOnlyRow }: RecipientRowProps) {
  const isAddressInvalid =
    row.address.length > 0 && !isValidEthAddress(row.address);
  const token = TOKEN_REGISTRY[row.tokenSymbol];
  const isAmountInvalid =
    row.amount.length > 0 &&
    (isNaN(parseFloat(row.amount)) || parseFloat(row.amount) <= 0);

  return (
    <div className={cn(
      "grid gap-3 px-5 py-3 items-start sm:grid-cols-[1fr_180px_140px_80px]",
      row.status === "failed" && "bg-red-500/5",
      row.status === "success" && "bg-emerald-500/5",
    )}>
      {/* Address */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 sm:hidden">Wallet Address</label>
        <div className="relative">
          <Input
            value={row.address}
            onChange={(e) =>
              onUpdate({ address: e.target.value.trim(), status: "idle", errorMessage: undefined })
            }
            placeholder="0xRecipientAddress"
            error={isAddressInvalid || row.status === "invalid"}
            className="font-mono text-xs"
          />
          {isAddressInvalid && (
            <AlertCircle className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" />
          )}
          {row.status === "success" && (
            <CheckCircle2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
          )}
        </div>
        {row.errorMessage && (
          <p className="text-xs text-red-400">{row.errorMessage}</p>
        )}
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 sm:hidden">Amount</label>
        <Input
          value={row.amount}
          onChange={(e) =>
            onUpdate({
              amount: clampAmountDecimals(sanitizeAmountInput(e.target.value), token.decimals),
              status: "idle",
            })
          }
          placeholder="0.00"
          error={isAmountInvalid}
          className="tabular-nums"
        />
      </div>

      {/* Token */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 sm:hidden">Token</label>
        <TokenSelector
          value={row.tokenSymbol}
          onChange={(t) => onUpdate({ tokenSymbol: t, status: "idle" })}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-2 pt-1">
        {(row.status === "pending" || row.status === "validating") && (
          <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
        )}
        {row.status !== "pending" && row.status !== "validating" && (
          <StatusBadge status={row.status} />
        )}
        <button
          onClick={onRemove}
          disabled={isOnlyRow}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-30"
          title="Remove row"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
