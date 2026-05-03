// ============================================================
// lib/blockchain/multisend.ts
// FINAL FIXED VERSION (EXPORTS + STABLE BUILD)
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

// ---------------- CONTRACT ADDRESS ----------------
export const MULTISEND_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS as Address | undefined) ??
  zeroAddress;

// ---------------- ABI ----------------
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

export const MAX_BATCH_SIZE = 200;

// ============================================================
// VALIDATION
// ============================================================
export async function validateBatch(
  rows: RecipientRow[],
  walletAddress: string,
  balances: Record<TokenSymbol, bigint>
) {
  const errors: Record<string, string> = {};
  const totals: Record<string, bigint> = {};

  for (const row of rows) {
    const token = TOKEN_REGISTRY[row.tokenSymbol];

    const amount = parseTokenAmount(row.amount, token.decimals);

    totals[row.tokenSymbol] =
      (totals[row.tokenSymbol] ?? BigInt(0)) + amount;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================
// GAS ESTIMATE
// ============================================================
export async function estimateBatchGas(rows: RecipientRow[]) {
  const grouped = groupRowsByToken(rows);

  let total = BigInt(0);

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];

    const per = token.isNative ? BigInt(30000) : BigInt(80000);
    total += per * BigInt(tokenRows.length);
  }

  return total;
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
  if (!account) throw new Error("No wallet connected");

  return executeBatchViaContract(rows, walletClient, publicClient, account, onProgress);
}

// ============================================================
// CONTRACT EXECUTION
// ============================================================
async function executeBatchViaContract(
  rows: RecipientRow[],
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
) {
  const grouped = groupRowsByToken(rows);
  let lastTxHash = "";

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];

    const recipients = tokenRows.map((r) => r.address as Address);

    let txHash: `0x${string}`;

    if (token.isNative) {
      const amountsWei = tokenRows.map((r) =>
        parseTokenAmount(r.amount, token.decimals)
      );

      const totalWei = amountsWei.reduce((a, b) => a + b, BigInt(0));

      await publicClient.simulateContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: NATIVE_ABI,
        functionName: "multisendNative",
        args: [recipients, amountsWei],
        account,
        value: totalWei,
      });

      txHash = await walletClient.writeContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: NATIVE_ABI,
        functionName: "multisendNative",
        args: [recipients, amountsWei],
        account,
        chain: arcTestnet,
        value: totalWei,
        maxFeePerGas: ARC_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });
    } else {
      const amounts = tokenRows.map((r) =>
        parseTokenAmount(r.amount, token.decimals)
      );

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

    lastTxHash = txHash;

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const status = receipt.status === "success" ? "success" : "failed";

    tokenRows.forEach((r) => onProgress(r.id, status, txHash));

    if (status === "failed") throw new Error("Transaction failed");
  }

  return { txHash: lastTxHash, success: true };
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

  const receipt = await client.getTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  return {
    status: receipt.status === "success" ? "confirmed" : "failed",
    blockNumber: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed,
  };
}