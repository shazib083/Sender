// ============================================================
// lib/blockchain/multisend.ts
//
// TRUE 2-INTERACTION FLOW (Permit2 fully removed):
//   Popup 1 — Multicall3From.aggregate3(): ONE tx that batches an
//             ERC-20 approve(MultiSend, EXACT_amount) for every token
//             in the batch. Multicall3From routes each subcall through
//             Arc's CallFrom precompile, so each approval is registered
//             with msg.sender == the user (not the Multicall contract).
//             => exact-amount allowances only, NEVER unlimited.
//   Popup 2 — multisendMultiToken(): pulls each ERC-20 via transferFrom
//             and forwards native USDC via msg.value, in a single tx.
//
// Native USDC on Arc is the gas token. The ArcSender contract sends it
// using msg.value (18-decimal wei) instead of transferFrom, so USDC rows
// require NO approval — only the wei value is attached to popup 2.
//
// FEE LOGIC (matches contract getFee):
//   1–50   recipients → 0 (free)
//   51–100 recipients → 5e16 wei (0.05 USDC)
//   101–200 recipients → 1e17 wei (0.10 USDC)
//
// All on-chain addresses are read from environment variables so they can
// be changed without touching code:
//   NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS  — deployed ArcSender contract
//   NEXT_PUBLIC_MULTICALL3FROM_ADDRESS      — Arc Multicall3From extension
//   NEXT_PUBLIC_USDC_CONTRACT_ADDRESS       — native USDC (handled via value)
// ============================================================

import {
  type Address,
  type WalletClient,
  type PublicClient,
  encodeFunctionData,
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

// ── Gas ───────────────────────────────────────────────────────────────
const ARC_MAX_FEE_PER_GAS  = parseGwei("200");
const ARC_MAX_PRIORITY_FEE = parseGwei("1");

// ── Fee constant (must match contract ArcSender.perAddressFee) ──────────
// PAY-PER-WALLET: flat 0.001 USDC per recipient, charged in native USDC.
// Arc native USDC uses 18-decimal wei for msg.value:
//   0.001 USDC = 1_000 (6-dec units) * 1e12 = 1e15 wei.
export const PER_ADDRESS_FEE_WEI = 10n ** 15n; // 0.001 USDC

// Total fee = recipientCount * 0.001 USDC (in 18-decimal native wei).
export function computeFeeWei(recipientCount: number): bigint {
  return BigInt(recipientCount) * PER_ADDRESS_FEE_WEI;
}

// Human label for the UI, e.g. "0.006 USDC" for 6 recipients.
export function getFeeLabel(recipientCount: number): string {
  const fee6 = BigInt(recipientCount) * 1000n; // 6-decimal USDC units (0.001 * 1e6)
  const whole = fee6 / 1_000_000n;
  const frac = (fee6 % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac} USDC` : `${whole} USDC`;
}

// ── Addresses from env (changeable without code edits) ────────────────
function requireAddress(value: string | undefined, name: string): Address {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`❌ ${name} is missing or invalid. Set it in your .env file.`);
  }
  return value as Address;
}

export const MULTISEND_CONTRACT_ADDRESS = requireAddress(
  process.env.NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS,
  "NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS"
);

export const MULTICALL3FROM_ADDRESS = requireAddress(
  process.env.NEXT_PUBLIC_MULTICALL3FROM_ADDRESS,
  "NEXT_PUBLIC_MULTICALL3FROM_ADDRESS"
);

// Native USDC address — handled via msg.value by the contract, so it is
// never approved or pulled via transferFrom. Falls back to the registry
// value when the env var is unset/placeholder.
const _usdcEnv = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS;
export const NATIVE_USDC_ADDRESS: Address =
  _usdcEnv &&
  /^0x[0-9a-fA-F]{40}$/.test(_usdcEnv) &&
  _usdcEnv !== "0x0000000000000000000000000000000000000000"
    ? (_usdcEnv as Address)
    : (TOKEN_REGISTRY.USDC.address as Address);

function isNativeUsdc(addr: Address): boolean {
  return addr.toLowerCase() === NATIVE_USDC_ADDRESS.toLowerCase();
}

// ── ABIs ──────────────────────────────────────────────────────────────
// Deployed ArcSender contract (see contracts/MultiSend.sol)
export const MULTISEND_ABI = [
  {
    name: "multisendMultiToken",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokens",     type: "address[]" },
      { name: "recipients", type: "address[]" },
      { name: "amounts",    type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    // Read fee from contract for UI display (pay-per-wallet = count * perAddressFee)
    name: "getFee",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Arc Multicall3From — same shape as Multicall3.aggregate3, but preserves
// the original msg.sender in every subcall via the CallFrom precompile.
export const MULTICALL3FROM_ABI = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target",       type: "address" },
          { name: "allowFailure", type: "bool"    },
          { name: "callData",     type: "bytes"   },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success",    type: "bool"  },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

export const MAX_BATCH_SIZE = 200;

// ── Gas estimation ────────────────────────────────────────────────────
export async function estimateBatchGas(rows: RecipientRow[]): Promise<bigint> {
  return BigInt(rows.length) * BigInt(90000);
}

// ── Validation ────────────────────────────────────────────────────────
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
    if (!row.address || !/^0x[0-9a-fA-F]{40}$/.test(row.address)) {
      errors[row.id] = "Invalid address";
      continue;
    }
    const token = TOKEN_REGISTRY[row.tokenSymbol];
    if (!token) {
      errors[row.id] = `Unknown token: ${row.tokenSymbol}`;
      continue;
    }
    const amount = parseTokenAmount(String(row.amount ?? "").trim(), token.decimals);
    if (amount <= 0n) {
      errors[row.id] = "Amount must be greater than 0";
      continue;
    }
    totals[row.tokenSymbol] = (totals[row.tokenSymbol] ?? 0n) + amount;
  }

  for (const [symbol, total] of Object.entries(totals)) {
    const token   = TOKEN_REGISTRY[symbol as TokenSymbol];
    const balance = balances[symbol as TokenSymbol] ?? 0n;
    if (total > balance) {
      const needed = formatTokenAmount(total, token.decimals);
      const have   = formatTokenAmount(balance, token.decimals);
      rows
        .filter((r) => r.tokenSymbol === symbol && !errors[r.id])
        .forEach((r) => {
          errors[r.id] = `Insufficient ${symbol} (need ${needed}, have ${have})`;
        });
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────
function buildArrays(rows: RecipientRow[]): {
  tokenAddresses: Address[];
  recipients:     Address[];
  amounts:        bigint[];
} {
  const tokenAddresses: Address[] = [];
  const recipients:     Address[] = [];
  const amounts:        bigint[]  = [];

  for (const row of rows) {
    const token = TOKEN_REGISTRY[row.tokenSymbol];
    if (!token?.address) throw new Error(`No address for token: ${row.tokenSymbol}`);
    tokenAddresses.push(token.address as Address);
    recipients.push(row.address as Address);
    amounts.push(parseTokenAmount(String(row.amount ?? "").trim(), token.decimals));
  }
  return { tokenAddresses, recipients, amounts };
}

/**
 * Exact ERC-20 allowance required per token for this batch.
 * Native USDC is excluded — the contract forwards it via msg.value, so it
 * is never pulled with transferFrom and needs no approval.
 */
function computeApprovalTotals(rows: RecipientRow[]): { address: Address; total: bigint }[] {
  const map = new Map<string, { address: Address; total: bigint }>();
  for (const row of rows) {
    const token = TOKEN_REGISTRY[row.tokenSymbol];
    if (!token?.address) continue;
    const addr = token.address as Address;
    if (isNativeUsdc(addr)) continue; // native USDC → msg.value, no approval
    const amount = parseTokenAmount(String(row.amount ?? "").trim(), token.decimals);
    const key = addr.toLowerCase();
    const prev = map.get(key);
    if (prev) prev.total += amount;
    else map.set(key, { address: addr, total: amount });
  }
  return Array.from(map.values());
}

/**
 * msg.value attached to popup 2:
 *   protocol fee (wei) + every native-USDC amount converted to 18-dec wei.
 */
export function computeMsgValueWei(rows: RecipientRow[]): bigint {
  let total = computeFeeWei(rows.length);
  for (const row of rows) {
    const token = TOKEN_REGISTRY[row.tokenSymbol];
    if (token?.address && isNativeUsdc(token.address as Address)) {
      const amount6 = parseTokenAmount(String(row.amount ?? "").trim(), token.decimals);
      total += amount6 * 10n ** 12n; // 6-dec USDC units → 18-dec native wei
    }
  }
  return total;
}

// ── POPUP 1: batch-approve EXACT amounts via Multicall3From ────────────
async function approveAllTokensBatch(
  rows: RecipientRow[],
  account: Address,
  walletClient: WalletClient,
  publicClient: PublicClient
): Promise<string | null> {
  const needed = computeApprovalTotals(rows);

  // Only approve tokens whose current allowance to the MultiSend contract
  // is below the exact amount this batch requires. Keeps popups minimal and
  // guarantees we never request more than what's needed (no unlimited).
  const calls: { target: Address; allowFailure: boolean; callData: `0x${string}` }[] = [];

  for (const { address, total } of needed) {
    const current = (await publicClient.readContract({
      address,
      abi:          ERC20_ABI,
      functionName: "allowance",
      args:         [account, MULTISEND_CONTRACT_ADDRESS],
    })) as bigint;

    if (current >= total) continue; // already sufficient for this batch

    const callData = encodeFunctionData({
      abi:          ERC20_ABI,
      functionName: "approve",
      args:         [MULTISEND_CONTRACT_ADDRESS, total], // EXACT amount, never maxUint
    });

    calls.push({ target: address, allowFailure: false, callData });
  }

  if (calls.length === 0) {
    console.log("✅ No approvals required (sufficient allowance / native USDC only)");
    return null; // no popup needed
  }

  console.log(`Batch-approving ${calls.length} token(s) via Multicall3From (exact amounts)`);

  const txHash = await walletClient.writeContract({
    address:              MULTICALL3FROM_ADDRESS,
    abi:                  MULTICALL3FROM_ABI,
    functionName:         "aggregate3",
    args:                 [calls],
    account,
    chain:                arcTestnet,
    maxFeePerGas:         ARC_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("✅ Batched approvals confirmed:", txHash);
  return txHash;
}

// ── POPUP 2: multisendMultiToken (transferFrom + native USDC) ──────────
async function executeMultisend(
  rows: RecipientRow[],
  account: Address,
  walletClient: WalletClient,
  publicClient: PublicClient
): Promise<{ txHash: string; success: boolean }> {
  const { tokenAddresses, recipients, amounts } = buildArrays(rows);
  const msgValue = computeMsgValueWei(rows);

  console.log("multisendMultiToken args:", {
    tokenAddresses,
    recipients,
    amounts: amounts.map(String),
    msgValue: msgValue.toString(),
    feeLabel: getFeeLabel(rows.length),
  });

  const txHash = await walletClient.writeContract({
    address:              MULTISEND_CONTRACT_ADDRESS,
    abi:                  MULTISEND_ABI,
    functionName:         "multisendMultiToken",
    args:                 [tokenAddresses, recipients, amounts],
    value:                msgValue, // protocol fee + native USDC amounts
    account,
    chain:                arcTestnet,
    maxFeePerGas:         ARC_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("✅ multisendMultiToken tx:", txHash);
  return { txHash, success: receipt.status === "success" };
}

// ── executeBatch — orchestrates the exact 2-popup flow ────────────────
export async function executeBatch(
  rows: RecipientRow[],
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void,
  onPhase?: (phase: "approving" | "sending") => void
): Promise<{ txHash: string; success: boolean }> {
  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");
  if (rows.length === 0)            throw new Error("No recipients");
  if (rows.length > MAX_BATCH_SIZE) throw new Error(`Max ${MAX_BATCH_SIZE} recipients`);

  rows.forEach((r) => onProgress(r.id, "pending"));

  // ── POPUP 1: approve all tokens in one batched transaction ───────────
  onPhase?.("approving");
  await approveAllTokensBatch(rows, account, walletClient, publicClient);

  // ── POPUP 2: distribute tokens + native USDC ─────────────────────────
  onPhase?.("sending");
  const { txHash, success } = await executeMultisend(
    rows, account, walletClient, publicClient
  );

  const rowStatus: RowStatus = success ? "success" : "failed";
  rows.forEach((r) => onProgress(r.id, rowStatus, txHash));

  return { txHash, success };
}

// ── Receipt ───────────────────────────────────────────────────────────
export async function getTransactionReceipt(
  txHash: string
): Promise<TxReceiptResult> {
  try {
    const client  = createArcPublicClient();
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    return {
      status:      receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: Number(receipt.blockNumber),
      gasUsed:     receipt.gasUsed,
    };
  } catch {
    return { status: "pending" };
  }
}