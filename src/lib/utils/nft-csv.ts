// ============================================================
// lib/utils/nft-csv.ts
// CSV parsing and template generation for NFT bulk send
// ============================================================

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { NftRecipientRow, NftStandard } from "@/types/nft";
import { isValidEthAddress } from "./validation";

export interface NftParseResult {
  rows: Omit<NftRecipientRow, "id" | "status">[];
  errors: string[];
  skipped: number;
}

// ---- Parse CSV file or text ----
// Expected columns: contract_address, token_id, amount, standard, recipient_address
// amount and standard are optional (default: "1", "ERC721")
export function parseNftCsv(input: string | File): Promise<NftParseResult> {
  return new Promise((resolve) => {
    const parse = (text: string) => {
      const result = Papa.parse<string[]>(text.trim(), {
        skipEmptyLines: true,
        header: false,
      });
      resolve(processNftParsedRows(result.data as string[][]));
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

function processNftParsedRows(rawRows: string[][]): NftParseResult {
  const rows: Omit<NftRecipientRow, "id" | "status">[] = [];
  const errors: string[] = [];
  let skipped = 0;

  // Skip header row if present
  const firstCell = rawRows[0]?.[0]?.toLowerCase() ?? "";
  const startIdx =
    firstCell.includes("contract") || firstCell.includes("address") ? 1 : 0;

  for (let i = startIdx; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) {
      skipped++;
      continue;
    }

    const contractAddress = row[0]?.trim() ?? "";
    const tokenId = row[1]?.trim() ?? "";
    const amount = row[2]?.trim() || "1";
    const standardRaw = row[3]?.trim().toUpperCase() ?? "ERC721";
    const recipientAddress = row[4]?.trim() ?? "";

    // Skip completely empty rows
    if (!contractAddress && !tokenId && !recipientAddress) {
      skipped++;
      continue;
    }

    if (!isValidEthAddress(contractAddress)) {
      errors.push(`Row ${i + 1}: Invalid contract address "${contractAddress}"`);
      skipped++;
      continue;
    }

    if (!tokenId || isNaN(Number(tokenId)) || Number(tokenId) < 0) {
      errors.push(`Row ${i + 1}: Invalid token ID "${tokenId}"`);
      skipped++;
      continue;
    }

    if (!isValidEthAddress(recipientAddress)) {
      errors.push(`Row ${i + 1}: Invalid recipient address "${recipientAddress}"`);
      skipped++;
      continue;
    }

    const standard: NftStandard =
      standardRaw === "ERC1155" ? "ERC1155" : "ERC721";

    const safeAmount = amount.replace(/[^0-9]/g, "") || "1";

    rows.push({
      contractAddress,
      tokenId,
      amount: safeAmount,
      standard,
      recipientAddress,
    });
  }

  return { rows, errors, skipped };
}

// ---- Generate XLSX template ----
export function generateNftTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["contract_address", "token_id", "amount", "standard", "recipient_address"],
    [
      "0x1234567890123456789012345678901234567890",
      "1",
      "1",
      "ERC721",
      "0xabcdef1234567890abcdef1234567890abcdef12",
    ],
    [
      "0x9876543210987654321098765432109876543210",
      "42",
      "5",
      "ERC1155",
      "0x1234567890abcdef1234567890abcdef12345678",
    ],
  ]);

  ws["!cols"] = [
    { wch: 45 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 45 },
  ];

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "6470F1" } },
    alignment: { horizontal: "center" },
  };
  ["A1", "B1", "C1", "D1", "E1"].forEach((cell) => {
    if (ws[cell]) ws[cell].s = headerStyle;
  });

  XLSX.utils.book_append_sheet(wb, ws, "NFT Recipients");
  XLSX.writeFile(wb, "Sender-nft-template.xlsx");
}

// ---- Export NFT transaction report ----
export function exportNftTransactionReport(
  rows: NftRecipientRow[],
  batchId: string
): void {
  const wb = XLSX.utils.book_new();
  const data = rows.map((r) => ({
    "Contract Address": r.contractAddress,
    "Token ID": r.tokenId,
    Amount: r.amount,
    Standard: r.standard,
    "Recipient Address": r.recipientAddress,
    Status: r.status,
    "TX Hash": r.txHash ?? "",
    Error: r.errorMessage ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 45 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 45 },
    { wch: 12 },
    { wch: 68 },
    { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "NFT Transactions");
  XLSX.writeFile(wb, `Sender-nft-batch-${batchId}-report.xlsx`);
}