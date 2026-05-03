// ============================================================
// lib/blockchain/multisend.ts (HARDENED FINAL VERSION)
// Fixes BigInt conversion + decimal handling + safe execution
// ============================================================

import {
  type Address,
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
// GAS ESTIMATE
// ============================================================
export async function estimateBatchGas(rows: RecipientRow[]): Promise<bigint> {
  let total = 0n;

  for (const r of rows) {
    const token = TOKEN_REGISTRY[r.tokenSymbol];
    total += token.isNative ? 50000n : 90000n;
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
    const balance = balances[symbol as TokenSymbol] ?? 0n;

    if (total > balance) {
      rows.forEach((r) => {
        if (r.tokenSymbol === symbol) {
          errors[r.id] = "Insufficient balance";
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
// MAIN EXECUTION (FIXED)
// ============================================================
export async function executeBatch(
  rows: RecipientRow[],
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
) {
  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");

  if (rows.length > MAX_BATCH_SIZE) {
    throw new Error(`Max batch size exceeded`);
  }

  rows.forEach((r) => onProgress(r.id, "pending"));

  const grouped = groupRowsByToken(rows);

  let lastTx = "";

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];

    const recipients = tokenRows.map((r) => r.address as Address);

    // =========================================================
    // ✅ FIXED SAFE BIGINT CONVERSION (NO raw BigInt("0.001"))
    // =========================================================
    const amounts: bigint[] = tokenRows.map((r) => {
  const value = String(r.amount ?? "").trim();

  if (!value) throw new Error("Empty amount");

  // 🔥 HARD FIX: normalize float → bigint safely
  const normalized = Number(value);

  if (isNaN(normalized) || normalized <= 0) {
    throw new Error(`Invalid amount: ${value}`);
  }

  // Arc USDC = 6 decimals
  const decimals = token.decimals;

  return BigInt(Math.floor(normalized * 10 ** decimals));
});

    const total = amounts.reduce((a, b) => a + b, 0n);
    
    console.log("🔥 TOTAL RAW VALUE:", total.toString());

    console.log("RECIPIENTS:", recipients);
    console.log("AMOUNTS:", amounts.map(String));
    console.log("TOTAL:", total.toString());

    let txHash: `0x${string}`;

    // =========================================================
    // NATIVE FLOW
    // =========================================================
   if (token.isNative) {
  // ===============================
  // 🔍 DEBUG LOG (ADD THIS FIRST)
  // ===============================
  console.log("🔥 NATIVE MULTISEND DEBUG:", {
    recipients,
    amounts: amounts.map(String),
    total: total.toString(),
    token: token.symbol,
  });

  // ===============================
  // SIMULATION
  // ===============================
  try {
    await publicClient.simulateContract({
      address: MULTISEND_CONTRACT_ADDRESS,
      abi: NATIVE_ABI,
      functionName: "multisendNative",
      args: [recipients, amounts],
      account,
      value: total,
      chain: arcTestnet,
    });
  } catch (err: any) {
    console.error("❌ SIMULATION FAILED:", err);
    throw new Error(
      err?.shortMessage ||
      err?.message ||
      "Simulation failed"
    );
  }

  // ===============================
  // EXECUTION
  // ===============================
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
}

    // =========================================================
    // ERC20 FLOW
    // =========================================================
    else {
      const allowance = (await publicClient.readContract({
        address: token.address as Address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account, MULTISEND_CONTRACT_ADDRESS],
      })) as bigint;

      if (allowance < total) {
        const approveTx = await walletClient.writeContract({
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [MULTISEND_CONTRACT_ADDRESS, total],
          account,
          chain: arcTestnet,
          maxFeePerGas: ARC_MAX_FEE_PER_GAS,
          maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
        });

        await publicClient.waitForTransactionReceipt({
          hash: approveTx,
        });
      }

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
      throw new Error("Transaction reverted");
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
export async function getTransactionReceipt(
  txHash: string
): Promise<TxReceiptResult> {
  try {
    const client = createArcPublicClient();
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