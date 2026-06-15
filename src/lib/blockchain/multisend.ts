// ============================================================
// lib/blockchain/multisend.ts
//
// TRUE 2-INTERACTION FLOW (after one-time Permit2 setup):
//   Popup 1 — signTypedData(PermitBatch) — gasless, no gas
//   Popup 2 — multisendPermit2() — permit + all transfers in 1 tx
//
// FEE LOGIC (matches contract):
//   1–50   recipients → 0 (free)
//   51–100 recipients → 5e16 wei (0.05 USDC)
//   101–200 recipients → 1e17 wei (0.10 USDC)
//
//   Arc Testnet: native USDC msg.value is in 18-decimal wei.
//   1 USDC (6-dec ERC20) = 1e18 wei as native.
//   Frontend computes fee in wei and passes as value.
// ============================================================

import {
  type Address,
  type WalletClient,
  type PublicClient,
  maxUint160,
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
import { parseGwei } from "viem";

// ── Gas ───────────────────────────────────────────────────────
const ARC_MAX_FEE_PER_GAS  = parseGwei("200");
const ARC_MAX_PRIORITY_FEE = parseGwei("1");

// ── Fee constants (must match contract) ───────────────────────
// Arc native USDC: msg.value in 18-decimal wei
const FREE_TIER_MAX = 50;
const MID_TIER_MAX  = 100;
const FEE_MID  = 5n * 10n ** 16n; // 0.05 USDC in wei
const FEE_HIGH = 1n * 10n ** 17n; // 0.10 USDC in wei

export function computeFeeWei(recipientCount: number): bigint {
  if (recipientCount <= FREE_TIER_MAX) return 0n;
  if (recipientCount <= MID_TIER_MAX)  return FEE_MID;
  return FEE_HIGH;
}

export function getFeeLabel(recipientCount: number): string {
  if (recipientCount <= FREE_TIER_MAX) return "Free";
  if (recipientCount <= MID_TIER_MAX)  return "0.05 USDC";
  return "0.10 USDC";
}

// ── Permit2 ───────────────────────────────────────────────────
const PERMIT2_ADDRESS: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const PERMIT2_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "token",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount",     type: "uint160" },
      { name: "expiration", type: "uint48"  },
      { name: "nonce",      type: "uint48"  },
    ],
  },
] as const;

const PERMIT_BATCH_TYPES = {
  PermitBatch: [
    { name: "details",     type: "PermitDetails[]" },
    { name: "spender",     type: "address"         },
    { name: "sigDeadline", type: "uint256"         },
  ],
  PermitDetails: [
    { name: "token",      type: "address" },
    { name: "amount",     type: "uint160" },
    { name: "expiration", type: "uint48"  },
    { name: "nonce",      type: "uint48"  },
  ],
} as const;

// ── MultiSend ABI ─────────────────────────────────────────────
export const MULTISEND_ABI = [
  {
    name: "multisendPermit2",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "permitBatch",
        type: "tuple",
        components: [
          {
            name: "details",
            type: "tuple[]",
            components: [
              { name: "token",      type: "address" },
              { name: "amount",     type: "uint160" },
              { name: "expiration", type: "uint48"  },
              { name: "nonce",      type: "uint48"  },
            ],
          },
          { name: "spender",     type: "address" },
          { name: "sigDeadline", type: "uint256" },
        ],
      },
      { name: "signature",  type: "bytes"     },
      { name: "tokens",     type: "address[]" },
      { name: "recipients", type: "address[]" },
      { name: "amounts",    type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    // Read fee from contract for UI display
    name: "getFee",
    type: "function",
    stateMutability: "pure",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const contractAddr = process.env
  .NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS as Address | undefined;
if (!contractAddr) throw new Error("❌ NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS not set");
export const MULTISEND_CONTRACT_ADDRESS = contractAddr;

export const MAX_BATCH_SIZE = 200;

// ── Gas estimation ────────────────────────────────────────────
export async function estimateBatchGas(rows: RecipientRow[]): Promise<bigint> {
  return BigInt(rows.length) * BigInt(90000);
}

// ── Validation ────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
function getUniqueTokenAddresses(rows: RecipientRow[]): Address[] {
  const seen = new Set<string>();
  const addrs: Address[] = [];
  for (const row of rows) {
    const token = TOKEN_REGISTRY[row.tokenSymbol];
    if (token?.address && !seen.has(token.address.toLowerCase())) {
      seen.add(token.address.toLowerCase());
      addrs.push(token.address as Address);
    }
  }
  return addrs;
}

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

// ── Sign PermitBatch — POPUP 1 (gasless) ─────────────────────
async function signPermitBatch(
  tokenAddresses: Address[],
  account: Address,
  walletClient: WalletClient,
  publicClient: PublicClient
): Promise<{
  permitBatch: {
    details: { token: Address; amount: bigint; expiration: number; nonce: number }[];
    spender: Address;
    sigDeadline: bigint;
  };
  signature: `0x${string}`;
}> {
  const expiration  = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const sigDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

  const details = await Promise.all(
    tokenAddresses.map(async (tokenAddress) => {
      const [, , nonce] = (await publicClient.readContract({
        address:      PERMIT2_ADDRESS,
        abi:          PERMIT2_ABI,
        functionName: "allowance",
        args:         [account, tokenAddress, MULTISEND_CONTRACT_ADDRESS],
      })) as [bigint, number, number];

      return {
        token:      tokenAddress,
        amount:     maxUint160,
        expiration: expiration,
        nonce:      nonce,
      };
    })
  );

  const permitBatch = {
    details,
    spender:     MULTISEND_CONTRACT_ADDRESS,
    sigDeadline,
  };

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name:              "Permit2",
      chainId:           arcTestnet.id,
      verifyingContract: PERMIT2_ADDRESS,
    },
    types:       PERMIT_BATCH_TYPES,
    primaryType: "PermitBatch",
    message:     permitBatch,
  });

  console.log("✅ PermitBatch signed (gasless)");
  return { permitBatch, signature };
}

// ── executeBatch ──────────────────────────────────────────────
export async function executeBatch(
  rows: RecipientRow[],
  onProgress: (rowId: string, status: RowStatus, txHash?: string) => void,
  onPhase?: (phase: "signing" | "sending") => void
): Promise<{ txHash: string; success: boolean }> {
  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");
  if (rows.length === 0)            throw new Error("No recipients");
  if (rows.length > MAX_BATCH_SIZE) throw new Error(`Max ${MAX_BATCH_SIZE} recipients`);

  rows.forEach((r) => onProgress(r.id, "pending"));

  const uniqueTokens = getUniqueTokenAddresses(rows);
  const { tokenAddresses, recipients, amounts } = buildArrays(rows);

  // Compute fee in wei — must be passed as msg.value
  const feeWei = computeFeeWei(rows.length);
  console.log(`Fee for ${rows.length} recipients: ${feeWei} wei (${getFeeLabel(rows.length)})`);

  // ── POPUP 1: gasless signature ────────────────────────────
  onPhase?.("signing");
  const { permitBatch, signature } = await signPermitBatch(
    uniqueTokens, account, walletClient, publicClient
  );

  // ── POPUP 2: permit + send in one tx ─────────────────────
  onPhase?.("sending");

  console.log("multisendPermit2 args:", {
    permitBatch,
    tokenAddresses,
    recipients,
    amounts: amounts.map(String),
    feeWei: feeWei.toString(),
  });

  const txHash = await walletClient.writeContract({
    address:              MULTISEND_CONTRACT_ADDRESS,
    abi:                  MULTISEND_ABI,
    functionName:         "multisendPermit2",
    args:                 [permitBatch, signature, tokenAddresses, recipients, amounts],
    value:                feeWei,   // ← fee passed here — was missing before!
    account,
    chain:                arcTestnet,
    maxFeePerGas:         ARC_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const rowStatus: RowStatus = receipt.status === "success" ? "success" : "failed";
  rows.forEach((r) => onProgress(r.id, rowStatus, txHash));
  console.log("✅ multisendPermit2 tx:", txHash);

  return { txHash, success: receipt.status === "success" };
}

// ── Receipt ───────────────────────────────────────────────────
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