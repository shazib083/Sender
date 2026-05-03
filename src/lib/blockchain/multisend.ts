// ============================================================
// lib/blockchain/multisend.ts
// Arc Testnet batch execution
//
// Arc Testnet specifics:
//   - USDC is the NATIVE gas token (like ETH on Ethereum)
//   - eth_getBalance / sendTransaction value uses 18-decimal wei
//   - User inputs & contract amounts use 6 decimals → multiply by 10^12 for wei
//   - Arc requires maxFeePerGas >= 160 Gwei (we use 200 to be safe)
//
// USDC send strategy:
//   - ALWAYS use sequential sendTransaction (native value sends)
//   - Do NOT use a multisendNative contract — we cannot verify the ABI
//     of the collected contract, and native value forwarding in contracts
//     on Arc requires exact ABI match.
//
// EURC send strategy:
//   - Standard ERC-20: approve + multisendToken if contract available
//   - Falls back to sequential transfer() calls if no contract set
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
  formatTokenAmount,
} from "./tokens";

import {
  type RecipientRow,
  type RowStatus,
  type TokenSymbol,
  type TxReceiptResult,
} from "@/types";

// ---- Arc gas config ----
const ARC_MAX_FEE_PER_GAS = parseGwei("200");
const ARC_MAX_PRIORITY_FEE = parseGwei("1");

// ---- Arc native USDC decimal conversion ----
// sendTransaction value needs 18-decimal wei
// User inputs in 6 decimals → multiply by 10^12
const WEI_MULTIPLIER = BigInt(10 ** 12);

function toWei(amount6: bigint): bigint {
  return amount6 * WEI_MULTIPLIER;
}

// ---- Contract ABIs ----
// Only the ERC-20 multisend ABI is used (for EURC)
// USDC (native) never goes through a contract
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
  (process.env.NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS as Address | undefined) ??
  zeroAddress;

export const MAX_BATCH_SIZE = 200;

// ---- Gas estimation ----
export async function estimateBatchGas(rows: RecipientRow[]): Promise<bigint> {
  let total = BigInt(0);
  for (const r of rows) {
    const token = TOKEN_REGISTRY[r.tokenSymbol];
    // Native USDC sends cost ~21000, ERC-20 transfers ~65000
    total += token.isNative ? BigInt(21000) : BigInt(65000);
  }
  return total;
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

// ---- Core batch execution ----
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
  let lastTx = "";
  let overallSuccess = true;

  for (const [symbol, tokenRows] of Object.entries(grouped)) {
    const token = TOKEN_REGISTRY[symbol as TokenSymbol];
    const recipients = tokenRows.map((r) => r.address as Address);

    const amounts6: bigint[] = tokenRows.map((r) => {
      const value = String(r.amount ?? "").trim();
      if (!value) throw new Error("Empty amount");
      return parseTokenAmount(value, token.decimals);
    });

    // =========================================================
    // NATIVE PATH — USDC on Arc
    //
    // Arc's USDC is the native gas token. We always use
    // sequential sendTransaction calls with wei-converted values.
    //
    // We do NOT use a multisendNative contract because:
    //   1. The contract ABI cannot be verified for this collected address
    //   2. Native value forwarding requires exact ABI match to avoid reverts
    //   3. Sequential sends are reliable and each produces an individual receipt
    // =========================================================
    if (token.isNative) {
      let lastNativeTx: `0x${string}` = "0x";
      let allSuccess = true;

      for (let i = 0; i < recipients.length; i++) {
        try {
          const amountWei = toWei(amounts6[i]);

          const nativeTx = await walletClient.sendTransaction({
            to: recipients[i],
            value: amountWei,
            account,
            chain: arcTestnet,
            maxFeePerGas: ARC_MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
          });

          const receipt = await publicClient.waitForTransactionReceipt({
            hash: nativeTx,
          });

          const status: RowStatus =
            receipt.status === "success" ? "success" : "failed";
          onProgress(tokenRows[i].id, status, nativeTx);
          lastNativeTx = nativeTx;
          if (status === "failed") allSuccess = false;
        } catch (err) {
          console.error(`Native USDC send failed for row ${tokenRows[i].id}:`, err);
          onProgress(tokenRows[i].id, "failed");
          allSuccess = false;
        }
      }

      lastTx = lastNativeTx;
      if (!allSuccess) overallSuccess = false;
      continue; // Move to next token group
    }

    // =========================================================
    // ERC-20 PATH — EURC
    // Uses 6-decimal amounts directly via approve + multisendToken
    // Falls back to sequential transfer() if no contract is set
    // =========================================================
    const total6 = amounts6.reduce((a, b) => a + b, BigInt(0));

    if (MULTISEND_CONTRACT_ADDRESS !== zeroAddress) {
      // Check and set allowance
      const allowance = (await publicClient.readContract({
        address: token.address as Address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account, MULTISEND_CONTRACT_ADDRESS],
      })) as bigint;

      if (allowance < total6) {
        const approveTx = await walletClient.writeContract({
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [MULTISEND_CONTRACT_ADDRESS, total6],
          account,
          chain: arcTestnet,
          maxFeePerGas: ARC_MAX_FEE_PER_GAS,
          maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      const txHash = await walletClient.writeContract({
        address: MULTISEND_CONTRACT_ADDRESS,
        abi: TOKEN_ABI,
        functionName: "multisendToken",
        args: [token.address as Address, recipients, amounts6],
        account,
        chain: arcTestnet,
        maxFeePerGas: ARC_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const status: RowStatus = receipt.status === "success" ? "success" : "failed";
      tokenRows.forEach((r) => onProgress(r.id, status, txHash));
      lastTx = txHash;
      if (status === "failed") overallSuccess = false;

    } else {
      // Sequential ERC-20 transfers (no contract)
      let lastErcTx: `0x${string}` = "0x";
      let allSuccess = true;

      for (let i = 0; i < recipients.length; i++) {
        try {
          const ercTx = await walletClient.writeContract({
            address: token.address as Address,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [recipients[i], amounts6[i]],
            account,
            chain: arcTestnet,
            maxFeePerGas: ARC_MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
          });
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: ercTx,
          });
          const status: RowStatus =
            receipt.status === "success" ? "success" : "failed";
          onProgress(tokenRows[i].id, status, ercTx);
          lastErcTx = ercTx;
          if (status === "failed") allSuccess = false;
        } catch (err) {
          console.error(`ERC-20 transfer failed for row ${tokenRows[i].id}:`, err);
          onProgress(tokenRows[i].id, "failed");
          allSuccess = false;
        }
      }

      lastTx = lastErcTx;
      if (!allSuccess) overallSuccess = false;
    }
  }

  return { txHash: lastTx, success: overallSuccess };
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