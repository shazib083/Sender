// ============================================================
// lib/blockchain/multisend.ts (FIXED STABLE EXECUTION VERSION)
// ============================================================

import {
  type Address,
  type PublicClient,
  type WalletClient,
  zeroAddress,
  parseGwei,
} from "viem";

import {
  arcTestnet,
  createArcPublicClient,
  createArcWalletClient,
} from "./provider";

import {
  ERC20_ABI,
  TOKEN_REGISTRY,
  parseTokenAmount,
  formatTokenAmount,
} from "./tokens";

import {
  type RecipientRow,
  type RowStatus,
  type TokenSymbol,
  type TxReceiptResult,
} from "@/types";

// ---------------- GAS CONFIG ----------------
const ARC_MAX_FEE_PER_GAS = parseGwei("200");
const ARC_MAX_PRIORITY_FEE = parseGwei("1");

// ---------------- CONTRACT ABI ----------------
export const MULTISEND_ABI = [
  {
    name: "multisendToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "multisendNative",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

const NATIVE_ABI = [MULTISEND_ABI[1]];
const TOKEN_ABI = [MULTISEND_ABI[0]];

// ---------------- CONFIG ----------------
export const MULTISEND_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS as Address | undefined) ??
  zeroAddress;

export const MAX_BATCH_SIZE = 200;

// ============================================================
// GAS ESTIMATION
// ============================================================
export async function estimateBatchGas(rows: RecipientRow[]): Promise<bigint> {
  const grouped = groupRowsByToken(rows);
  let total = BigInt(0);

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];
    const per = token.isNative ? BigInt(50000) : BigInt(90000);
    total += per * BigInt(tokenRows.length);
  }

  return total;
}

// ============================================================
// VALIDATION
// ============================================================
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export async function validateBatch(
  rows: RecipientRow[],
  walletAddress: string,
  balances: Record<TokenSymbol, bigint>
): Promise<ValidationResult> {
  const errors: Record<string, string> = {};
  const totals: Record<TokenSymbol, bigint> = {} as any;

  for (const row of rows) {
    const token = TOKEN_REGISTRY[row.tokenSymbol];

    if (!row.address || !/^0x[0-9a-fA-F]{40}$/.test(row.address)) {
      errors[row.id] = "Invalid address";
      continue;
    }

    const amount = parseTokenAmount(row.amount, token.decimals);

    if (amount <= 0n) {
      errors[row.id] = "Invalid amount";
      continue;
    }

    totals[row.tokenSymbol] =
      (totals[row.tokenSymbol] ?? 0n) + amount;
  }

  for (const [symbol, total] of Object.entries(totals)) {
    const bal = balances[symbol as TokenSymbol] ?? 0n;

    if (total > bal) {
      rows.forEach((r) => {
        if (r.tokenSymbol === symbol) {
          errors[r.id] = `Insufficient ${symbol}`;
        }
      });
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================
// MAIN EXECUTION
// ============================================================
export async function executeBatch(
  rows: RecipientRow[],
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
) {
  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet");

  rows.forEach((r) => onProgress(r.id, "pending"));

  const grouped = groupRowsByToken(rows);

  let lastTx = "";

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];

    const recipients = tokenRows.map((r) => r.address as Address);

    let txHash: `0x${string}`;

    // =========================================================
    // FIX: DO NOT DOUBLE SCALE — contract expects raw parsed units
    // =========================================================
    const amounts = tokenRows.map((r) =>
      parseTokenAmount(r.amount, token.decimals)
    );

    const total = amounts.reduce((a, b) => a + b, 0n);

    if (token.isNative) {
      await publicClient.simulateContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: NATIVE_ABI,
        functionName: "multisendNative",
        args: [recipients, amounts],
        account,
        value: total,
      });

      txHash = await walletClient.writeContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: NATIVE_ABI,
        functionName: "multisendNative",
        args: [recipients, amounts],
        account,
        chain: arcTestnet,
        value: total,
        maxFeePerGas: ARC_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });
    } else {
      await publicClient.simulateContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: TOKEN_ABI,
        functionName: "multisendToken",
        args: [token.address as Address, recipients, amounts],
        account,
      });

      txHash = await walletClient.writeContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: TOKEN_ABI,
        functionName: "multisendToken",
        args: [token.address as Address, recipients, amounts],
        account,
        chain: arcTestnet,
        maxFeePerGas: ARC_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });
    }

    lastTx = txHash;

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const status: RowStatus =
      receipt.status === "success" ? "success" : "failed";

    tokenRows.forEach((r) => onProgress(r.id, status, txHash));

    if (status === "failed") {
      throw new Error("Multisend reverted");
    }
  }

  return { txHash: lastTx, success: true };
}

// ============================================================
// HELPERS
// ============================================================
function groupRowsByToken(rows: RecipientRow[]) {
  return rows.reduce((acc, row) => {
    acc[row.tokenSymbol] = [...(acc[row.tokenSymbol] || []), row];
    return acc;
  }, {} as Record<string, RecipientRow[]>);
}

// ============================================================
// RECEIPT
// ============================================================
export async function getTransactionReceipt(txHash: string): Promise<TxReceiptResult> {
  const client = createArcPublicClient();

  try {
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    return {
      status: receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed,
    };
  } catch {
    return { status: "pending" };
  }
}