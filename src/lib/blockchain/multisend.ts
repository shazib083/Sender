// ============================================================
// lib/blockchain/multisend.ts
// Arc Testnet specifics:
// - USDC is native gas token, 18-decimal wei for sendTransaction
// - User inputs in 6 decimals → multiply by 10^12 for sendTransaction
// - Arc requires maxFeePerGas >= 160 Gwei explicitly
// - ERC-20 interface (EURC) uses standard 6-decimal amounts
// ============================================================

import {
  type Address,
  type PublicClient,
  type WalletClient,
  zeroAddress,
  parseGwei,
} from "viem";
import { arcTestnet, createArcPublicClient, createArcWalletClient } from "./provider";
import { ERC20_ABI, TOKEN_REGISTRY, parseTokenAmount, formatTokenAmount } from "./tokens";
import { type RecipientRow, type RowStatus, type TokenSymbol, type TxReceiptResult } from "@/types";

// ---- Arc gas config ----
// Arc requires maxFeePerGas >= 160 Gwei (minimum base fee)
const ARC_MAX_FEE_PER_GAS = parseGwei("200"); // 200 Gwei — safely above 160 Gwei minimum
const ARC_MAX_PRIORITY_FEE = parseGwei("1");   // 1 Gwei tip

// ---- Arc native USDC decimal conversion ----
// sendTransaction value = 18-decimal wei (like ETH on Ethereum)
// User input = 6-decimal USDC
// Multiply by 10^12 to convert
const WEI_MULTIPLIER = BigInt(10 ** 12);

function toWei(amount6: bigint): bigint {
  return amount6 * WEI_MULTIPLIER;
}

// ---- MultiSend Contract ABI ----
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
  {
    name: "multisendMixed",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokens", type: "address[]" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "TokensSent",
    type: "event",
    inputs: [
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "sender", type: "address" },
      { indexed: false, name: "totalAmount", type: "uint256" },
      { indexed: false, name: "recipientCount", type: "uint256" },
    ],
  },
] as const;

const NATIVE_ABI = [
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

const TOKEN_ABI = [
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
] as const;

export const MULTISEND_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS as Address | undefined) ?? zeroAddress;

export const MAX_BATCH_SIZE = 200;
export const SAFE_BATCH_CHUNK = 100;

// ---- Gas estimation ----
export async function estimateBatchGas(rows: RecipientRow[]): Promise<bigint> {
  try {
    const grouped = groupRowsByToken(rows);
    let totalGas = BigInt(0);
    for (const [symbol, tokenRows] of Object.entries(grouped)) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];
      const gasPerTx = token.isNative ? BigInt(21000) : BigInt(65000);
      totalGas = totalGas + gasPerTx * BigInt(tokenRows.length);
    }
    return totalGas;
  } catch {
    return BigInt(0);
  }
}

// ---- Core batch execution ----
export async function executeBatch(
  rows: RecipientRow[],
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
): Promise<{ txHash: string; success: boolean }> {
  if (rows.length === 0) throw new Error("No recipients to send to");
  if (rows.length > MAX_BATCH_SIZE)
    throw new Error(`Batch size ${rows.length} exceeds maximum of ${MAX_BATCH_SIZE}`);

  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet account found");

  rows.forEach((r) => onProgress(r.id, "pending"));

  try {
    if (MULTISEND_CONTRACT_ADDRESS !== zeroAddress) {
      return await executeBatchViaContract(rows, walletClient, publicClient, account, onProgress);
    } else {
      return await executeBatchSequential(rows, walletClient, publicClient, account, onProgress);
    }
  } catch (error) {
    rows.forEach((r) => onProgress(r.id, "failed"));
    throw error;
  }
}

// ---- Contract-based batch ----
async function executeBatchViaContract(
  rows: RecipientRow[],
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
): Promise<{ txHash: string; success: boolean }> {
  const grouped = groupRowsByToken(rows);

  // Step 1: Approve ERC-20 tokens
  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];
    if (token.isNative) continue;

    const totalAmount = tokenRows.reduce(
      (acc, r) => acc + parseTokenAmount(r.amount, token.decimals),
      BigInt(0)
    );

    const allowance = await publicClient.readContract({
      address: token.address as Address,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account, MULTISEND_CONTRACT_ADDRESS],
    });

    if ((allowance as bigint) < totalAmount) {
      const approveTx = await walletClient.writeContract({
        address: token.address as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [MULTISEND_CONTRACT_ADDRESS, totalAmount],
        account,
        chain: arcTestnet,
        maxFeePerGas: ARC_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
  }

  // Step 2: Execute multisend per token group
  let lastTxHash = "";

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];
    const recipients = tokenRows.map((r) => r.address as Address);
    const amounts6 = tokenRows.map((r) => parseTokenAmount(r.amount, token.decimals));

    let txHash: `0x${string}`;

    if (token.isNative) {
      // Convert 6-decimal to 18-decimal wei for native value
      const amountsWei = amounts6.map((a) => toWei(a));
      const totalWei = amountsWei.reduce((a, b) => a + b, BigInt(0));

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
      txHash = await walletClient.writeContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: TOKEN_ABI,
        functionName: "multisendToken",
        args: [token.address as Address, recipients, amounts6],
        account,
        chain: arcTestnet,
        maxFeePerGas: ARC_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });
    }

    lastTxHash = txHash;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const status: RowStatus = receipt.status === "success" ? "success" : "failed";
    tokenRows.forEach((r) => onProgress(r.id, status, txHash));
  }

  return { txHash: lastTxHash, success: true };
}

// ---- Sequential fallback ----
async function executeBatchSequential(
  rows: RecipientRow[],
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
): Promise<{ txHash: string; success: boolean }> {
  let lastTxHash = "";
  let allSuccess = true;

  for (const row of rows) {
    try {
      const token = TOKEN_REGISTRY[row.tokenSymbol];
      const amount6 = parseTokenAmount(row.amount, token.decimals);

      let txHash: `0x${string}`;

      if (token.isNative) {
        // Convert 6-decimal USDC to 18-decimal wei
        const valueWei = toWei(amount6);
        txHash = await walletClient.sendTransaction({
          to: row.address as Address,
          value: valueWei,
          account,
          chain: arcTestnet,
          maxFeePerGas: ARC_MAX_FEE_PER_GAS,
          maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
        });
      } else {
        txHash = await walletClient.writeContract({
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [row.address as Address, amount6],
          account,
          chain: arcTestnet,
          maxFeePerGas: ARC_MAX_FEE_PER_GAS,
          maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
        });
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const status: RowStatus = receipt.status === "success" ? "success" : "failed";
      onProgress(row.id, status, txHash);
      lastTxHash = txHash;
      if (status === "failed") allSuccess = false;
    } catch (err) {
      console.error(`Row ${row.id} failed:`, err);
      onProgress(row.id, "failed");
      allSuccess = false;
    }
  }

  return { txHash: lastTxHash, success: allSuccess };
}

// ---- Helpers ----
function groupRowsByToken(rows: RecipientRow[]): Record<string, RecipientRow[]> {
  return rows.reduce(
    (acc, row) => {
      acc[row.tokenSymbol] = [...(acc[row.tokenSymbol] ?? []), row];
      return acc;
    },
    {} as Record<string, RecipientRow[]>
  );
}

export async function getTransactionReceipt(
  txHash: string
): Promise<TxReceiptResult> {
  try {
    const client = createArcPublicClient();
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    return {
      status: receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed,
      timestamp: block.timestamp
        ? new Date(Number(block.timestamp) * 1000)
        : undefined,
    };
  } catch {
    return { status: "pending" };
  }
}

// ---- Validate all rows before execution ----
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
      errors[row.id] = "Invalid wallet address";
      continue;
    }

    const amount = parseTokenAmount(row.amount, token.decimals);
    if (amount <= BigInt(0)) {
      errors[row.id] = "Amount must be greater than 0";
      continue;
    }

    totals[row.tokenSymbol] = (totals[row.tokenSymbol] ?? BigInt(0)) + amount;
  }

  for (const [symbol, total] of Object.entries(totals)) {
    const available = balances[symbol as TokenSymbol] ?? BigInt(0);
    if (total > available) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];
      const needed = formatTokenAmount(total, token.decimals);
      const have = formatTokenAmount(available, token.decimals);
      rows
        .filter((r) => r.tokenSymbol === symbol && !errors[r.id])
        .forEach((r) => {
          errors[r.id] = `Insufficient ${symbol} balance (need ${needed}, have ${have})`;
        });
    }
  }

  if (rows.length > MAX_BATCH_SIZE) {
    rows.slice(MAX_BATCH_SIZE).forEach((r) => {
      errors[r.id] = `Exceeds maximum batch size of ${MAX_BATCH_SIZE}`;
    });
  }

  return { valid: Object.keys(errors).length === 0, errors };
}