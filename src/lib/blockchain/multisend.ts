// ============================================================
// lib/blockchain/multisend.ts
// FIXED VERSION (MATCHES YOUR CONTRACT)
// ============================================================

import {
  type Address,
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

// ---- Arc gas config ----
import { parseGwei } from "viem";

const ARC_FALLBACK_MAX_FEE_PER_GAS = parseGwei("200");
const ARC_MAX_PRIORITY_FEE = parseGwei("1");

interface GasPriceResponse {
  fast?: number;
}

async function getArcMaxFeePerGas(): Promise<bigint> {
  try {
    const response = await fetch("/api/gas-price");
    if (!response.ok) return ARC_FALLBACK_MAX_FEE_PER_GAS;

    const gasPrice = (await response.json()) as GasPriceResponse;
    if (!gasPrice.fast || !Number.isFinite(gasPrice.fast) || gasPrice.fast <= 0) {
      return ARC_FALLBACK_MAX_FEE_PER_GAS;
    }

    return parseGwei(gasPrice.fast.toString());
  } catch {
    return ARC_FALLBACK_MAX_FEE_PER_GAS;
  }
}

// ---- CONTRACT ABI (FIXED) ----
export const MULTISEND_ABI = [
  {
    name: "multisend",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
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
  {
    name: "InsufficientFee",
    type: "error",
    inputs: [
      { name: "required", type: "uint256" },
      { name: "provided", type: "uint256" },
    ],
  },
  {
    name: "TooManyRecipients",
    type: "error",
    inputs: [
      { name: "count", type: "uint256" },
      { name: "max", type: "uint256" },
    ],
  },
  {
    name: "ArrayLengthMismatch",
    type: "error",
    inputs: [],
  },
  {
    name: "TransferFailed",
    type: "error",
    inputs: [],
  },
  {
    name: "ZeroRecipients",
    type: "error",
    inputs: [],
  },
] as const;

// ---- ENV (STRICT) ----
const addr = process.env.NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS as Address | undefined;

if (!addr) {
  throw new Error("❌ MULTISEND CONTRACT ADDRESS NOT SET");
}

export const MULTISEND_CONTRACT_ADDRESS = addr;

export const MAX_BATCH_SIZE = 200;
const NATIVE_USDC_DECIMAL_OFFSET = BigInt(10 ** 12);
const FREE_TIER_MAX = 50;
const MID_TIER_MAX = 100;
const FEE_MID = BigInt("50000000000000000");
const FEE_HIGH = BigInt("100000000000000000");

function toNativeValue(amount: bigint): bigint {
  return amount * NATIVE_USDC_DECIMAL_OFFSET;
}

function getMultisendFee(count: number): bigint {
  if (count <= FREE_TIER_MAX) return BigInt(0);
  if (count <= MID_TIER_MAX) return FEE_MID;
  return FEE_HIGH;
}

// ---- Gas estimation ----
export async function estimateBatchGas(rows: RecipientRow[]): Promise<bigint> {
  return BigInt(rows.length) * BigInt(90000);
}

// ---- Validation ----
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
  const totals: Record<TokenSymbol, bigint> = {} as Record<TokenSymbol, bigint>;

  for (const row of rows) {
    const token = TOKEN_REGISTRY[row.tokenSymbol];

    if (!row.address || !/^0x[0-9a-fA-F]{40}$/.test(row.address)) {
      errors[row.id] = "Invalid address";
      continue;
    }

    const amount = parseTokenAmount(row.amount, token.decimals);
    if (amount <= BigInt(0)) {
      errors[row.id] = "Invalid amount";
      continue;
    }

    totals[row.tokenSymbol] = (totals[row.tokenSymbol] ?? BigInt(0)) + amount;
  }

  for (const [symbol, total] of Object.entries(totals)) {
    const balance = balances[symbol as TokenSymbol] ?? BigInt(0);

    if (total > balance) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];
      const needed = formatTokenAmount(total, token.decimals);
      const have = formatTokenAmount(balance, token.decimals);

      rows
        .filter((r) => r.tokenSymbol === symbol && !errors[r.id])
        .forEach((r) => {
          errors[r.id] = `Insufficient balance (need ${needed}, have ${have})`;
        });
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---- Core execution ----
export async function executeBatch(
  rows: RecipientRow[],
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
): Promise<{ txHash: string; success: boolean }> {
  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");

  if (rows.length === 0) throw new Error("No recipients");
  if (rows.length > MAX_BATCH_SIZE) throw new Error("Max batch size exceeded");

  rows.forEach((r) => onProgress(r.id, "pending"));

  const grouped = groupRowsByToken(rows);
  const maxFeePerGas = await getArcMaxFeePerGas();
  let lastTx = "";

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];

    const recipients = tokenRows.map((r) => r.address as Address);

    const amounts: bigint[] = tokenRows.map((r) => {
      const value = String(r.amount ?? "").trim();
      if (!value) throw new Error("Empty amount");
      return parseTokenAmount(value, token.decimals); // ✅ 6 decimals
    });

    const total = amounts.reduce((a, b) => a + b, BigInt(0));
    const batchFee = getMultisendFee(tokenRows.length);

    if (token.isNative) {
      const nativeAmounts = amounts.map(toNativeValue);
      const nativeTotal = nativeAmounts.reduce((a, b) => a + b, BigInt(0));

      await publicClient.simulateContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: MULTISEND_ABI,
        functionName: "multisendNative",
        args: [recipients, nativeAmounts],
        account,
        value: nativeTotal,
      });

      const txHash = await walletClient.writeContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: MULTISEND_ABI,
        functionName: "multisendNative",
        args: [recipients, nativeAmounts],
        account,
        chain: arcTestnet,
        value: nativeTotal,
        maxFeePerGas,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });

      lastTx = txHash;

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      const status: RowStatus =
        receipt.status === "success" ? "success" : "failed";

      tokenRows.forEach((r) => onProgress(r.id, status, txHash));
      continue;
    }

    // ---- APPROVAL ----
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
        maxFeePerGas,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }

    // ---- SIMULATION (CRITICAL) ----
    await publicClient.simulateContract({
      address: MULTISEND_CONTRACT_ADDRESS,
      abi: MULTISEND_ABI,
      functionName: "multisend",
      args: [token.address as Address, recipients, amounts],
      account,
      value: batchFee,
    });

    // ---- EXECUTION ----
    const txHash = await walletClient.writeContract({
      address: MULTISEND_CONTRACT_ADDRESS,
      abi: MULTISEND_ABI,
      functionName: "multisend",
      args: [token.address as Address, recipients, amounts],
      account,
      chain: arcTestnet,
      value: batchFee,
      maxFeePerGas,
      maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
    });

    lastTx = txHash;

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const status: RowStatus =
      receipt.status === "success" ? "success" : "failed";

    tokenRows.forEach((r) => onProgress(r.id, status, txHash));
  }

  return { txHash: lastTx, success: true };
}

// ---- Helpers ----
function groupRowsByToken(rows: RecipientRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc[row.tokenSymbol] = [...(acc[row.tokenSymbol] || []), row];
      return acc;
    },
    {} as Record<string, RecipientRow[]>
  );
}

// ---- Receipt ----
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
