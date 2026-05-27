"use client";
import { useState } from "react";
import { X, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExampleLine {
  label?: string;
  value: string;
}

interface CsvPasteModalProps {
  onClose: () => void;
  onSubmit: (csv: string) => void;
  title?: string;
  description?: string;
  exampleLines?: ExampleLine[];
}

const DEFAULT_EXAMPLE_LINES: ExampleLine[] = [
  { value: "0x1234...abcd, 10.50, USDC" },
  { value: "0xabcd...1234, 5.00, EURC" },
  { value: "0x9876...dcba, 0.01, cirBTC" },
];

export function CsvPasteModal({
  onClose,
  onSubmit,
  title = "Paste CSV Data",
  description = "Format: address, amount, token (one per line)",
  exampleLines = DEFAULT_EXAMPLE_LINES,
}: CsvPasteModalProps) {
  const [value, setValue] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-surface-400 bg-surface-100 p-6 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Example block */}
        <div className="mb-3 rounded-lg border border-surface-400 bg-surface-200 p-3 text-xs font-mono text-gray-400">
          <div className="text-gray-500 mb-1.5 font-sans">Example:</div>
          {exampleLines.map((line, i) => (
            <div key={i} className="leading-relaxed">
              {line.label && (
                <span className="text-gray-600 select-none">{line.label} </span>
              )}
              <span>{line.value}</span>
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your CSV data here..."
          rows={10}
          className="w-full rounded-xl border border-surface-400 bg-surface-200 p-3 font-mono text-sm text-gray-200 placeholder-gray-600 resize-none focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30 transition-colors"
          autoFocus
        />

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onSubmit(value)}
            disabled={!value.trim()}
          >
            <ClipboardPaste className="h-4 w-4" />
            Import Recipients
          </Button>
        </div>
      </div>
    </div>
  );
}
