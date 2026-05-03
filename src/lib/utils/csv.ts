// ============================================================
// lib/utils/csv.ts
// CSV parsing, validation, and template generation
// ============================================================

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { CsvRow, RecipientRow, TokenSymbol } from "@/types";
import { TOKEN_REGISTRY } from "@/lib/blockchain/tokens";
import { isValidEthAddress } from "./validation";

export interface ParseResult {
  rows: Omit<RecipientRow, "id" | "status">[];
  errors: string[];
  skipped: number;
}

// ---- Parse CSV file or text ----
export function parseCsv(input: string | File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const parse = (text: string) => {
      const result = Papa.parse<string[]>(text.trim(), {
        skipEmptyLines: true,
        header: false,
      });
      resolve(processParsedRows(result.data as string[][]));
    };

    if (typeof input === "string") {
      parse(input);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => parse(e.target?.result as string);
      reader.readAsText(input);
    }
  });
}

function processParsedRows(rawRows: string[][]): ParseResult {
  const rows: Omit<RecipientRow, "id" | "status">[] = [];
  const errors: string[] = [];
  let skipped = 0;

  // Skip header if present
  const startIdx =
    rawRows.length > 0 &&
    (rawRows[0][0]?.toLowerCase().includes("address") ||
      rawRows[0][0]?.toLowerCase().includes("wallet"))
      ? 1
      : 0;

  for (let i = startIdx; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) {
      skipped++;
      continue;
    }

    const address = row[0]?.trim() ?? "";
    const amount = row[1]?.trim() ?? "";
    const tokenRaw = row[2]?.trim().toUpperCase() ?? "USDC";

    if (!address && !amount) {
      skipped++;
      continue;
    }

    if (!isValidEthAddress(address)) {
      errors.push(`Row ${i + 1}: Invalid address "${address}"`);
      skipped++;
      continue;
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      errors.push(`Row ${i + 1}: Invalid amount "${amount}"`);
      skipped++;
      continue;
    }

    const tokenSymbol = (["USDC", "EURC", "ETH"].includes(tokenRaw)
      ? tokenRaw
      : "USDC") as TokenSymbol;

    // Sanitize amount: prevent injection, allow only numbers + dot
    const safeAmount = amount.replace(/[^0-9.]/g, "").slice(0, 20);

    rows.push({
      address,
      amount: safeAmount,
      tokenSymbol,
    });
  }

  return { rows, errors, skipped };
}

// ---- Generate XLSX template ----
export function generateTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["wallet_address", "amount", "token"],
    ["0x1234567890123456789012345678901234567890", "10.00", "USDC"],
    ["0xabcdef1234567890abcdef1234567890abcdef12", "25.50", "EURC"],
    ["0x9876543210987654321098765432109876543210", "5.00", "USDC"],
  ]);

  // Column widths
  ws["!cols"] = [{ wch: 45 }, { wch: 15 }, { wch: 10 }];

  // Style header row
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "6470F1" } },
    alignment: { horizontal: "center" },
  };
  ["A1", "B1", "C1"].forEach((cell) => {
    if (ws[cell]) ws[cell].s = headerStyle;
  });

  XLSX.utils.book_append_sheet(wb, ws, "Recipients");
  XLSX.writeFile(wb, "Sender-multisend-template.xlsx");
}

// ---- Export transaction report ----
export function exportTransactionReport(
  rows: RecipientRow[],
  batchId: string
): void {
  const wb = XLSX.utils.book_new();
  const data = rows.map((r) => ({
    "Wallet Address": r.address,
    Amount: r.amount,
    Token: r.tokenSymbol,
    Status: r.status,
    "TX Hash": r.txHash ?? "",
    Error: r.errorMessage ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 45 }, { wch: 12 }, { wch: 8 },
    { wch: 12 }, { wch: 68 }, { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  XLSX.writeFile(wb, `Sender-batch-${batchId}-report.xlsx`);
}
