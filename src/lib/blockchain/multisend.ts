// ============================================================
// lib/blockchain/multisend.ts (FIXED FINAL VERSION)
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

  return executeBatchViaContract(
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
      // ❗ IMPORTANT: Arc native uses 6 decimals (NOT 18)
      const amountsWei = tokenRows.map((r) =>
        parseTokenAmount(r.amount, token.decimals)
      );

      const totalWei = amountsWei.reduce((a, b) => a + b, BigInt(0));

      if (totalWei <= 0n) {
        throw new Error("Invalid transfer amount");
      }

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

        await publicClient.waitForTransactionReceipt({ hash: approveTx });
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

    const status: RowStatus =
      receipt.status === "success" ? "success" : "failed";

    tokenRows.forEach((r) => onProgress(r.id, status, txHash));

    if (status === "failed") {
      throw new Error("Transaction reverted");
    }
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