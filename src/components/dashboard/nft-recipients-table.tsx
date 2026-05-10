"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Upload, ClipboardPaste, Download,
  AlertCircle, CheckCircle2, Loader2, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNftStore } from "@/lib/store/nft-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { parseNftCsv, generateNftTemplate } from "@/lib/utils/nft-csv";
import { sanitizeCsvInput, isValidEthAddress } from "@/lib/utils/validation";
import { detectNftStandard } from "@/lib/blockchain/nft";
import { CsvPasteModal } from "./csv-paste-modal";
import type { NftRecipientRow, NftStandard } from "@/types/nft";
import toast from "react-hot-toast";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

const MAX_ROWS = 200;

// ---- Standard selector ----
function StandardSelector({
  value,
  onChange,
}: {
  value: NftStandard;
  onChange: (v: NftStandard) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as NftStandard)}>
      <Select.Trigger
        className={cn(
          "flex h-10 min-w-[110px] items-center gap-2 rounded-xl border border-surface-400",
          "bg-surface-200 px-3 text-sm text-gray-100 hover:border-surface-500",
          "focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-colors"
        )}
      >
        <Select.Value />
        <Select.Icon className="ml-auto text-gray-500">
          <ChevronDown className="h-4 w-4" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="z-50 min-w-[120px] overflow-hidden rounded-xl border border-surface-400 bg-surface-100 shadow-xl animate-slide-up"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-1">
            {(["ERC721", "ERC1155"] as NftStandard[]).map((std) => (
              <Select.Item
                key={std}
                value={std}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none hover:bg-surface-300 data-[highlighted]:bg-surface-300 transition-colors"
              >
                <Select.ItemText>{std}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check className="h-3.5 w-3.5 text-brand-400" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

// ---- Main table ----
export function NftRecipientsTable() {
  const { rows, addRow, updateRow, removeRow, clearRows, importRows } = useNftStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);

  const NFT_CSV_EXAMPLE = [
    { value: "0x1234...abcd, 1, 1, ERC721, 0xRecip...1234" },
    { value: "0xabcd...1234, 42, 5, ERC1155, 0xRecip...abcd" },
  ];

  const handleFileUpload = async (file: File) => {
    const result = await parseNftCsv(file);
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
      `Imported ${result.rows.length} NFT recipient(s)${result.skipped ? ` (${result.skipped} skipped)` : ""}`
    );
    if (result.errors.length > 0) {
      toast.error(`${result.errors.length} rows had errors and were skipped`, { duration: 6000 });
    }
  };

  const handlePasteCsv = async (raw: string) => {
    const safe = sanitizeCsvInput(raw);
    const result = await parseNftCsv(safe);
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
    toast.success(`Imported ${result.rows.length} NFT recipient(s)`);
  };

  const filledRows = rows.filter(
    (r) => r.contractAddress || r.tokenId || r.recipientAddress
  );

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-surface-300 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">NFT Recipients</h2>
          <p className="text-sm text-gray-500">
            {filledRows.length} of {MAX_ROWS} max recipients
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
          <Button variant="secondary" size="sm" onClick={generateNftTemplate}>
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => { clearRows(); toast.success("All NFT rows cleared"); }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear All
          </Button>
        </div>
      </div>

      {/* Column headers */}
      <div className="hidden grid-cols-[1.2fr_0.8fr_0.6fr_0.8fr_1.2fr_80px] gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500 lg:grid">
        <span>Contract Address</span>
        <span>Token ID</span>
        <span>Amount</span>
        <span>Standard</span>
        <span>Recipient Address</span>
        <span className="text-center">Action</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-surface-300">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <NftRowItem
                row={row}
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

      {/* CSV format hint */}
      <div className="border-t border-surface-300 px-5 py-3">
        <p className="text-xs text-gray-600">
          CSV format:{" "}
          <span className="font-mono text-gray-500">
            contract_address, token_id, amount, standard (ERC721/ERC1155), recipient_address
          </span>
        </p>
      </div>

      {showPasteModal && (
        <CsvPasteModal
          onClose={() => setShowPasteModal(false)}
          onSubmit={handlePasteCsv}
          title="Paste NFT CSV Data"
          description="Format: contract_address, token_id, amount, standard, recipient_address"
          exampleLines={NFT_CSV_EXAMPLE}
        />
      )}
    </div>
  );
}

// ---- Single NFT row ----
interface NftRowItemProps {
  row: NftRecipientRow;
  onUpdate: (updates: Partial<NftRecipientRow>) => void;
  onRemove: () => void;
  isOnlyRow: boolean;
}

function NftRowItem({ row, onUpdate, onRemove, isOnlyRow }: NftRowItemProps) {
  const [detecting, setDetecting] = useState(false);
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isContractInvalid =
    row.contractAddress.length > 0 && !isValidEthAddress(row.contractAddress);
  const isRecipientInvalid =
    row.recipientAddress.length > 0 && !isValidEthAddress(row.recipientAddress);
  const isTokenIdInvalid =
    row.tokenId.length > 0 && (isNaN(Number(row.tokenId)) || Number(row.tokenId) < 0);

  // Auto-detect standard when contract address is typed
  const handleContractChange = useCallback(
    (value: string) => {
      onUpdate({ contractAddress: value.trim(), status: "idle", errorMessage: undefined });

      if (detectTimer.current) clearTimeout(detectTimer.current);
      if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value.trim())) return;

      detectTimer.current = setTimeout(async () => {
        setDetecting(true);
        try {
          const detected = await detectNftStandard(value.trim());
          if (detected) onUpdate({ standard: detected });
        } finally {
          setDetecting(false);
        }
      }, 800);
    },
    [onUpdate]
  );

  useEffect(() => {
    return () => {
      if (detectTimer.current) clearTimeout(detectTimer.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "grid gap-2 px-5 py-3 items-start lg:grid-cols-[1.2fr_0.8fr_0.6fr_0.8fr_1.2fr_80px]",
        row.status === "failed" && "bg-red-500/5",
        row.status === "success" && "bg-emerald-500/5"
      )}
    >
      {/* Contract Address */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 lg:hidden">Contract Address</label>
        <div className="relative">
          <Input
            value={row.contractAddress}
            onChange={(e) => handleContractChange(e.target.value)}
            placeholder="0xContract..."
            error={isContractInvalid || row.status === "invalid"}
            className="font-mono text-xs pr-8"
          />
          {detecting && (
            <RefreshCw className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-brand-400" />
          )}
          {isContractInvalid && !detecting && (
            <AlertCircle className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" />
          )}
        </div>
        {row.errorMessage && (
          <p className="text-xs text-red-400 leading-tight">{row.errorMessage}</p>
        )}
      </div>

      {/* Token ID */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 lg:hidden">Token ID</label>
        <Input
          value={row.tokenId}
          onChange={(e) =>
            onUpdate({
              tokenId: e.target.value.replace(/[^0-9]/g, ""),
              status: "idle",
              errorMessage: undefined,
            })
          }
          placeholder="0"
          error={isTokenIdInvalid}
          className="tabular-nums"
        />
      </div>

      {/* Amount (ERC-1155 only) */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 lg:hidden">Amount</label>
        <Input
          value={row.amount}
          onChange={(e) =>
            onUpdate({ amount: e.target.value.replace(/[^0-9]/g, "") || "1", status: "idle" })
          }
          placeholder="1"
          disabled={row.standard === "ERC721"}
          className={cn("tabular-nums", row.standard === "ERC721" && "opacity-40 cursor-not-allowed")}
        />
      </div>

      {/* Standard */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 lg:hidden">Standard</label>
        <StandardSelector
          value={row.standard}
          onChange={(v) => onUpdate({ standard: v, status: "idle", amount: v === "ERC721" ? "1" : row.amount })}
        />
      </div>

      {/* Recipient Address */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 lg:hidden">Recipient Address</label>
        <div className="relative">
          <Input
            value={row.recipientAddress}
            onChange={(e) =>
              onUpdate({ recipientAddress: e.target.value.trim(), status: "idle", errorMessage: undefined })
            }
            placeholder="0xRecipient..."
            error={isRecipientInvalid}
            className="font-mono text-xs"
          />
          {isRecipientInvalid && (
            <AlertCircle className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" />
          )}
          {row.status === "success" && (
            <CheckCircle2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-2 pt-1">
        {(row.status === "pending" || row.status === "validating") ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
        ) : (
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