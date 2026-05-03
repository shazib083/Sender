// ============================================================
// lib/blockchain/multisend.ts (FINAL STABLE VERSION)
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
// GAS ESTIMATION (for UI)
// ============================================================
export async function estimateBatchGas(
  rows: RecipientRow[]
): Promise<bigint> {
  try {
    const grouped = groupRowsByToken(rows);
    let total = BigInt(0);

    for (const [symbol, tokenRows] of Object.entries(grouped)) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];
      const per = token.isNative ? BigInt(30000) : BigInt(80000);
      total += per * BigInt(tokenRows.length);
    }

    return total;
  } catch {
    return BigInt(0);
  }
}

// ============================================================
// VALIDATION (used by UI)
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
  const totals: Record<TokenSymbol, bigint> = {} as Record<
    TokenSymbol,
    bigint
  >;

  for (const row of rows) {
    const token = TOKEN_REGISTRY[row.tokenSymbol];

    if (!row.address || !/^0x[0-9a-fA-F]{40}$/.test(row.address)) {
      errors[row.id] = "Invalid wallet address";
      continue;
    }

    if (row.address.toLowerCase() === walletAddress.toLowerCase()) {
      errors[row.id] = "Cannot send to your own wallet";
      continue;
    }

    const amount = parseTokenAmount(row.amount, token.decimals);

    if (amount <= BigInt(0)) {
      errors[row.id] = "Amount must be greater than 0";
      continue;
    }

    totals[row.tokenSymbol] =
      (totals[row.tokenSymbol] ?? BigInt(0)) + amount;
  }

  for (const [symbol, total] of Object.entries(totals)) {
    const available = balances[symbol as TokenSymbol] ?? BigInt(0);

    if (total > available) {
      const token = TOKEN_REGISTRY[symbol as TokenSymbol];

      const need = formatTokenAmount(total, token.decimals);
      const have = formatTokenAmount(available, token.decimals);

      rows
        .filter((r) => r.tokenSymbol === symbol && !errors[r.id])
        .forEach((r) => {
          errors[r.id] = `Insufficient ${symbol} (need ${need}, have ${have})`;
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
): Promise<{ txHash: string; success: boolean }> {
  if (!rows.length) throw new Error("No recipients");
  if (rows.length > MAX_BATCH_SIZE)
    throw new Error(`Max batch size ${MAX_BATCH_SIZE}`);

  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");

  rows.forEach((r) => onProgress(r.id, "pending"));

  if (MULTISEND_CONTRACT_ADDRESS !== zeroAddress) {
    return executeBatchViaContract(
      rows,
      walletClient,
      publicClient,
      account,
      onProgress
    );
  }

  return executeBatchSequential(
    rows,
    walletClient,
    publicClient,
    account,
    onProgress
  );
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

    // ================= NATIVE =================
    if (token.isNative) {
      // 🔥 FIX: ALWAYS 18 DECIMALS
      const amounts6 = tokenRows.map((r) =>
        parseTokenAmount(r.amount, token.decimals)
      );

        // convert 6 → 18 decimals safely
      const amountsWei = amounts6.map(
        (a) => a * BigInt(10 ** (18 - token.decimals))
    );

const totalWei = amountsWei.reduce((a, b) => a + b, BigInt(0));

      const totalWei = amountsWei.reduce((a, b) => a + b, BigInt(0));

      // simulate first (prevents revert tx)
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
    }

    // ================= ERC20 =================
    else {
      const amounts = tokenRows.map((r) =>
        parseTokenAmount(r.amount, token.decimals)
      );

      const totalAmount = amounts.reduce((a, b) => a + b, BigInt(0));

      const allowance = (await publicClient.readContract({
        address: token.address as Address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account, MULTISEND_CONTRACT_ADDRESS],
      })) as bigint;

      if (allowance < totalAmount) {
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

    lastTxHash = txHash;

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const status = receipt.status === "success" ? "success" : "failed";

    tokenRows.forEach((r) => onProgress(r.id, status, txHash));

    if (status === "failed") {
      throw new Error("Transaction reverted");
    }
  }

  return { txHash: lastTxHash, success: true };
}

// ============================================================
// FALLBACK (NO CONTRACT)
// ============================================================
async function executeBatchSequential(
  rows: RecipientRow[],
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
) {
  let lastTxHash = "";
  let allSuccess = true;

  for (const row of rows) {
    try {
      const token = TOKEN_REGISTRY[row.tokenSymbol];

      let txHash: `0x${string}`;

      if (token.isNative) {
        const value = parseTokenAmount(row.amount, 18);

        txHash = await walletClient.sendTransaction({
          to: row.address as Address,
          value,
          account,
          chain: arcTestnet,
          maxFeePerGas: ARC_MAX_FEE_PER_GAS,
          maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
        });
      } else {
        const amount = parseTokenAmount(
          row.amount,
          token.decimals
        );

        txHash = await walletClient.writeContract({
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [row.address as Address, amount],
          account,
          chain: arcTestnet,
          maxFeePerGas: ARC_MAX_FEE_PER_GAS,
          maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
        });
      }

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      const status = receipt.status === "success" ? "success" : "failed";

      onProgress(row.id, status, txHash);

      if (status === "failed") allSuccess = false;

      lastTxHash = txHash;
    } catch {
      onProgress(row.id, "failed");
      allSuccess = false;
    }
  }

  return { txHash: lastTxHash, success: allSuccess };
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