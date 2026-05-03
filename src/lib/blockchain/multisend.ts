// ============================================================
// lib/blockchain/multisend.ts
// MultiSend contract ABI + batch execution logic
// ============================================================
// IMPORTANT: Deploy contracts/MultiSend.sol to Arc testnet and
// set NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS in .env.local
//
// If no MultiSend contract is available, this module falls back
// to sequential ERC-20 transfers (less gas efficient but safe).
// ============================================================

import {
  type Address,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
} from "viem";
import { arcTestnet, createArcPublicClient, createArcWalletClient } from "./provider";
import { ERC20_ABI, TOKEN_REGISTRY, parseTokenAmount, formatTokenAmount } from "./tokens";
import { type RecipientRow, type RowStatus, type TokenSymbol, type TxReceiptResult } from "@/types";

// ---- MultiSend Contract ABI ----
// Matches contracts/MultiSend.sol
export const MULTISEND_ABI = parseAbi([
  "function multisend(address token, address[] recipients, uint256[] amounts)",
  "event PaymentSent(address indexed recipient, uint256 amount)",
]);

export const MULTISEND_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS as Address | undefined) ?? zeroAddress;

export const MAX_BATCH_SIZE = 200;
export const SAFE_BATCH_CHUNK = 100; // chunk large batches

// ---- Gas estimation ----
export async function estimateBatchGas(rows: RecipientRow[]): Promise<bigint> {
  try {
    const client = createArcPublicClient();
    const grouped = groupRowsByToken(rows);

    let totalGas = 0n;

    for (const [symbol, tokenRows] of Object.entries(grouped)) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];
      const recipients = tokenRows.map((r) => r.address as Address);
      const amounts = tokenRows.map((r) => parseTokenAmount(r.amount, token.decimals));

      if (MULTISEND_CONTRACT_ADDRESS === zeroAddress) {
        // Sequential fallback: 65k gas per ERC-20 transfer
        totalGas += BigInt(tokenRows.length) * 65000n;
        continue;
      }

      try {
        const gas = await client.estimateContractGas({
          address: MULTISEND_CONTRACT_ADDRESS,
          abi: MULTISEND_ABI,
          functionName: "multisend",
          args: token.isNative ? [recipients, amounts] : [token.address as Address, recipients, amounts],
          account: zeroAddress,
        });
        totalGas += gas;
      } catch {
        totalGas += BigInt(tokenRows.length) * 65000n;
      }
    }

    return totalGas;
  } catch {
    return 0n;
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

  // Mark all rows as pending
  rows.forEach((r) => onProgress(r.id, "pending"));

  try {
    if (MULTISEND_CONTRACT_ADDRESS !== zeroAddress) {
      return await executeBatchViaContract(rows, walletClient, publicClient, account, onProgress);
    } else {
      // Fallback: sequential transfers
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

  // Step 1: Approve tokens
  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];
    if (token.isNative) continue;

    const totalAmount = tokenRows.reduce(
      (acc, r) => acc + parseTokenAmount(r.amount, token.decimals),
      0n
    );

    // Check existing allowance
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
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
  }

  // Step 2: Execute multisend for each token group
  let lastTxHash = "";

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];
    const recipients = tokenRows.map((r) => r.address as Address);
    const amounts = tokenRows.map((r) => parseTokenAmount(r.amount, token.decimals));
    const nativeValue = token.isNative
      ? amounts.reduce((a, b) => a + b, 0n)
      : undefined;

    const txHash = await walletClient.writeContract({
      address: MULTISEND_CONTRACT_ADDRESS,
      abi: MULTISEND_ABI,
      functionName: "multisend",
      args: token.isNative
        ? [recipients, amounts]
        : [token.address as Address, recipients, amounts],
      account,
      chain: arcTestnet,
      value: nativeValue,
    });

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
      const amount = parseTokenAmount(row.amount, token.decimals);

      let txHash: `0x${string}`;

      if (token.isNative) {
        txHash = await walletClient.sendTransaction({
          to: row.address as Address,
          value: amount,
          account,
          chain: arcTestnet,
        });
      } else {
        txHash = await walletClient.writeContract({
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [row.address as Address, amount],
          account,
          chain: arcTestnet,
        });
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const status: RowStatus = receipt.status === "success" ? "success" : "failed";
      onProgress(row.id, status, txHash);
      lastTxHash = txHash;
      if (status === "failed") allSuccess = false;
    } catch {
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
      timestamp: block.timestamp ? new Date(Number(block.timestamp) * 1000) : undefined,
    };
  } catch {
    return { status: "pending" };
  }
}

// ---- Validate all rows before execution ----
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>; // rowId -> error message
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

    // Validate address
    if (!row.address || !/^0x[0-9a-fA-F]{40}$/.test(row.address)) {
      errors[row.id] = "Invalid wallet address";
      continue;
    }

    // Validate amount
    const amount = parseTokenAmount(row.amount, token.decimals);
    if (amount <= 0n) {
      errors[row.id] = "Amount must be greater than 0";
      continue;
    }

    // Accumulate totals
    totals[row.tokenSymbol] = (totals[row.tokenSymbol] ?? 0n) + amount;
  }

  // Check balances
  for (const [symbol, total] of Object.entries(totals)) {
    const available = balances[symbol as TokenSymbol] ?? 0n;
    if (total > available) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];
      const needed = formatTokenAmount(total, token.decimals);
      const have = formatTokenAmount(available, token.decimals);
      // Mark rows with this token as failing balance check
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
