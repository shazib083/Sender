// ============================================================
// lib/blockchain/nft.ts
// ERC-721 & ERC-1155 ABIs, detection, validation, execution
// ============================================================

import { type Address, parseGwei, encodeFunctionData } from "viem";
import { createArcPublicClient, createArcWalletClient, arcTestnet } from "./provider";
import type { NftRecipientRow, NftRowStatus, NftStandard } from "@/types/nft";

// ---- Gas config (mirrors multisend.ts) ----
const ARC_MAX_FEE_PER_GAS = parseGwei("200");
const ARC_MAX_PRIORITY_FEE = parseGwei("1");

// ---- NftMultiSend contract address ----
const NFT_MULTISEND_ADDRESS = (
  process.env.NEXT_PUBLIC_NFT_MULTISEND_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as Address;

// ---- NftMultiSend ABI ----
export const NFT_MULTISEND_ABI = [
  {
    name: "multisendERC721",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token",      type: "address"   },
      { name: "recipients", type: "address[]" },
      { name: "tokenIds",   type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "multisendERC1155",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token",      type: "address"   },
      { name: "recipients", type: "address[]" },
      { name: "ids",        type: "uint256[]" },
      { name: "amounts",    type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "batchToOneERC1155",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token",     type: "address"   },
      { name: "recipient", type: "address"   },
      { name: "ids",       type: "uint256[]" },
      { name: "amounts",   type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    // NEW: mixed multi-collection NFT multisend. Sends ANY mix of ERC-721 /
    // ERC-1155 collections in one tx and charges the fee ONCE (msg.value) on
    // the total recipient count. Lets fee-bearing multi-collection batches
    // collapse into exactly two popups (Arc's Multicall3From has no
    // aggregate3Value, so the fee is attached directly to this single call).
    // standards[i]: 0 = ERC721, 1 = ERC1155. amounts ignored for ERC721 rows.
    name: "multisendMixedNFT",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "standards",  type: "uint8[]"    },
      { name: "tokens",     type: "address[]"  },
      { name: "recipients", type: "address[]"  },
      { name: "tokenIds",   type: "uint256[]"  },
      { name: "amounts",    type: "uint256[]"  },
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
    name: "ZeroRecipients",
    type: "error",
    inputs: [],
  },
] as const;

const FREE_TIER_MAX = 50;
const MID_TIER_MAX = 100;
const FEE_MID = BigInt("50000000000000000");
const FEE_HIGH = BigInt("100000000000000000");

function getNftMultisendFee(count: number): bigint {
  if (count <= FREE_TIER_MAX) return BigInt(0);
  if (count <= MID_TIER_MAX) return FEE_MID;
  return FEE_HIGH;
}

// ---- ERC-165 interface IDs ----
const ERC721_INTERFACE_ID = "0x80ac58cd" as `0x${string}`;
const ERC1155_INTERFACE_ID = "0xd9b67a26" as `0x${string}`;

// ---- ERC-165 ABI ----
export const ERC165_ABI = [
  {
    name: "supportsInterface",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ---- Minimal ERC-721 ABI ----
export const ERC721_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "safeTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// ---- Minimal ERC-1155 ABI ----
export const ERC1155_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "safeTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "safeBatchTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "ids", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "uri",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// ---- Detect NFT standard via ERC-165 ----
export async function detectNftStandard(
  contractAddress: string
): Promise<NftStandard | null> {
  if (!contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) return null;
  const client = createArcPublicClient();
  try {
    const is1155 = await client.readContract({
      address: contractAddress as Address,
      abi: ERC165_ABI,
      functionName: "supportsInterface",
      args: [ERC1155_INTERFACE_ID],
    });
    if (is1155) return "ERC1155";

    const is721 = await client.readContract({
      address: contractAddress as Address,
      abi: ERC165_ABI,
      functionName: "supportsInterface",
      args: [ERC721_INTERFACE_ID],
    });
    if (is721) return "ERC721";

    return null;
  } catch {
    return null;
  }
}

// ---- Validate NFT ownership for a single row ----
export async function validateNftOwnership(
  row: NftRecipientRow,
  walletAddress: string
): Promise<string | null> {
  const client = createArcPublicClient();
  const contract = row.contractAddress as Address;
  const tokenId = BigInt(row.tokenId || "0");

  try {
    if (row.standard === "ERC721") {
      const owner = (await client.readContract({
        address: contract,
        abi: ERC721_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      })) as Address;

      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        return `Token #${row.tokenId} is not owned by connected wallet`;
      }
    } else {
      const balance = (await client.readContract({
        address: contract,
        abi: ERC1155_ABI,
        functionName: "balanceOf",
        args: [walletAddress as Address, tokenId],
      })) as bigint;

      const needed = BigInt(row.amount || "1");
      if (balance < needed) {
        return `Insufficient balance for token #${row.tokenId} (have ${balance}, need ${needed})`;
      }
    }
    return null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Ownership check failed: ${msg.slice(0, 80)}`;
  }
}

// ---- Validate all rows ----
export interface NftValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export async function validateNftBatch(
  rows: NftRecipientRow[],
  walletAddress: string
): Promise<NftValidationResult> {
  const errors: Record<string, string> = {};

  await Promise.all(
    rows.map(async (row) => {
      if (!row.contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(row.contractAddress)) {
        errors[row.id] = "Invalid contract address";
        return;
      }
      if (!row.recipientAddress || !/^0x[0-9a-fA-F]{40}$/.test(row.recipientAddress)) {
        errors[row.id] = "Invalid recipient address";
        return;
      }
      if (!row.tokenId || isNaN(Number(row.tokenId)) || Number(row.tokenId) < 0) {
        errors[row.id] = "Invalid token ID";
        return;
      }
      if (
        row.standard === "ERC1155" &&
        (!row.amount || isNaN(Number(row.amount)) || Number(row.amount) <= 0)
      ) {
        errors[row.id] = "Invalid amount";
        return;
      }

      const ownershipError = await validateNftOwnership(row, walletAddress);
      if (ownershipError) {
        errors[row.id] = ownershipError;
      }
    })
  );

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---- Multicall3From (Arc tx extension) — batches subcalls while preserving msg.sender ----
// Used ONLY when a batch spans MULTIPLE NFT collections, to collapse the flow into exactly
// two wallet popups (one aggregated approve + one aggregated transfer) — the same architecture
// the token flow uses. Single-collection batches keep the original direct-call path untouched.
// Address comes from the same env var the token flow uses.
const MULTICALL3FROM_ADDRESS = (
  process.env.NEXT_PUBLIC_MULTICALL3FROM_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as Address;

const MULTICALL3FROM_ABI = [
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

// ---- Execute NFT batch via NftMultiSend contract ----
// • Single collection   → original direct path (1 approve popup + 1 transfer popup), UNCHANGED.
// • Multiple collections → Multicall3From batches ALL approvals into ONE popup and ALL transfers
//   into ONE popup. Each subcall is routed through Arc's CallFrom precompile, so msg.sender is
//   preserved and ArcSender still pulls each NFT from the user. Exactly two popups total —
//   mirrors the token flow's Multicall3From architecture.
export async function executeNftBatch(
  rows: NftRecipientRow[],
  onProgress: (rowId: string, status: NftRowStatus, txHash?: string) => void,
  onPhase?: (phase: "approving" | "sending") => void
): Promise<{ txHashes: `0x${string}`[]; success: boolean }> {
  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");

  rows.forEach((r) => onProgress(r.id, "pending"));

  const txHashes: `0x${string}`[] = [];
  const grouped = groupNftRows(rows);
  const groups = Object.entries(grouped) as [string, NftRecipientRow[]][];

  // ── SINGLE COLLECTION: keep the proven direct path (behaviour unchanged) ──
  if (groups.length <= 1) {
    onPhase?.("approving");
    await approveCollectionsDirect(groups, account, walletClient, publicClient);

    onPhase?.("sending");
    await sendGroupsDirect(groups, account, walletClient, publicClient, onProgress, txHashes);

    return { txHashes, success: true };
  }

  // ── MULTIPLE COLLECTIONS: exactly two popups via Multicall3From ──
  // Popup 1 — one aggregated approve covering every collection that still needs it.
  onPhase?.("approving");
  await approveAllCollectionsBatch(groups, account, walletClient, publicClient);

  // Popup 2 — ONE transfer call for every collection, fee or not.
  // multisendMixedNFT (on the ArcSender contract) walks any mix of ERC-721 /
  // ERC-1155 collections in a single tx and charges the protocol fee ONCE on
  // the TOTAL recipient count, attached directly as msg.value. This sidesteps
  // Arc's missing aggregate3Value: instead of batching N payable sub-calls
  // through Multicall3From, the fee rides on this single direct call. So the
  // fee-bearing (>50 / >100) multi-collection case now also collapses into
  // exactly two popups, matching the fee-free flow.
  onPhase?.("sending");
  try {
    const txHash = await sendAllTransfersMixed(groups, account, walletClient, publicClient);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const status: NftRowStatus = receipt.status === "success" ? "success" : "failed";
    rows.forEach((r) => onProgress(r.id, status, txHash));
    txHashes.push(txHash);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    rows.forEach((r) => onProgress(r.id, "failed"));
    throw new Error(`NFT batch transfer failed: ${msg.slice(0, 140)}`);
  }

  return { txHashes, success: true };
}

// ── Direct path helpers (single collection — original logic, untouched) ──────
async function approveCollectionsDirect(
  groups: [string, NftRecipientRow[]][],
  account: Address,
  walletClient: ReturnType<typeof createArcWalletClient>,
  publicClient: ReturnType<typeof createArcPublicClient>
): Promise<void> {
  for (const [key] of groups) {
    const [contractAddress, standard] = key.split("::") as [string, NftStandard];
    const contract = contractAddress as Address;
    const abi = standard === "ERC721" ? ERC721_ABI : ERC1155_ABI;

    const isApproved = (await publicClient.readContract({
      address: contract,
      abi,
      functionName: "isApprovedForAll",
      args: [account, NFT_MULTISEND_ADDRESS],
    })) as boolean;

    if (!isApproved) {
      const approvalTx = await walletClient.writeContract({
        address: contract,
        abi,
        functionName: "setApprovalForAll",
        args: [NFT_MULTISEND_ADDRESS, true],
        account,
        chain: arcTestnet,
        maxFeePerGas: ARC_MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalTx });
    }
  }
}

async function sendGroupsDirect(
  groups: [string, NftRecipientRow[]][],
  account: Address,
  walletClient: ReturnType<typeof createArcWalletClient>,
  publicClient: ReturnType<typeof createArcPublicClient>,
  onProgress: (rowId: string, status: NftRowStatus, txHash?: string) => void,
  txHashes: `0x${string}`[]
): Promise<void> {
  for (const [key, groupRows] of groups) {
    const [contractAddress, standard] = key.split("::") as [string, NftStandard];
    const contract = contractAddress as Address;

    if (standard === "ERC721") {
      // ── ERC-721: call multisendERC721 with all recipients + tokenIds ──
      try {
        const recipients = groupRows.map((r) => r.recipientAddress as Address);
        const tokenIds   = groupRows.map((r) => BigInt(r.tokenId));
        const rowIds     = groupRows.map((r) => r.id);
        const batchFee   = getNftMultisendFee(groupRows.length);

        const txHash: `0x${string}` = await walletClient.writeContract({
          address: NFT_MULTISEND_ADDRESS,
          abi: NFT_MULTISEND_ABI,
          functionName: "multisendERC721",
          args: [contract, recipients, tokenIds],
          account,
          chain: arcTestnet,
          value: batchFee,
          maxFeePerGas: ARC_MAX_FEE_PER_GAS,
          maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        const status: NftRowStatus = receipt.status === "success" ? "success" : "failed";
        rowIds.forEach((id) => onProgress(id, status, txHash));
        txHashes.push(txHash);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        groupRows.forEach((r) => onProgress(r.id, "failed"));
        throw new Error(`ERC-721 multisend failed: ${msg.slice(0, 100)}`);
      }
    } else {
      // ── ERC-1155: group by recipient for batchToOneERC1155,
      //    or use multisendERC1155 when recipients differ ──
      const byRecipient = groupBy1155ByRecipient(groupRows);
      const recipientList = Object.keys(byRecipient);

      if (recipientList.length === 1) {
        // All rows go to the same recipient — use safeBatchTransferFrom
        const recipient = recipientList[0] as Address;
        const recipientRows = byRecipient[recipientList[0]];
        try {
          const ids     = recipientRows.map((r) => BigInt(r.tokenId));
          const amounts = recipientRows.map((r) => BigInt(r.amount || "1"));
          const rowIds  = recipientRows.map((r) => r.id);
          const batchFee = getNftMultisendFee(recipientRows.length);

          const txHash: `0x${string}` = await walletClient.writeContract({
            address: NFT_MULTISEND_ADDRESS,
            abi: NFT_MULTISEND_ABI,
            functionName: "batchToOneERC1155",
            args: [contract, recipient, ids, amounts],
            account,
            chain: arcTestnet,
            value: batchFee,
            maxFeePerGas: ARC_MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          const status: NftRowStatus = receipt.status === "success" ? "success" : "failed";
          rowIds.forEach((id) => onProgress(id, status, txHash));
          txHashes.push(txHash);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          byRecipient[recipientList[0]].forEach((r) => onProgress(r.id, "failed"));
          throw new Error(`ERC-1155 batch failed: ${msg.slice(0, 100)}`);
        }
      } else {
        // Multiple different recipients — use multisendERC1155
        try {
          const recipients = groupRows.map((r) => r.recipientAddress as Address);
          const ids        = groupRows.map((r) => BigInt(r.tokenId));
          const amounts    = groupRows.map((r) => BigInt(r.amount || "1"));
          const rowIds     = groupRows.map((r) => r.id);
          const batchFee   = getNftMultisendFee(groupRows.length);

          const txHash: `0x${string}` = await walletClient.writeContract({
            address: NFT_MULTISEND_ADDRESS,
            abi: NFT_MULTISEND_ABI,
            functionName: "multisendERC1155",
            args: [contract, recipients, ids, amounts],
            account,
            chain: arcTestnet,
            value: batchFee,
            maxFeePerGas: ARC_MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          const status: NftRowStatus = receipt.status === "success" ? "success" : "failed";
          rowIds.forEach((id) => onProgress(id, status, txHash));
          txHashes.push(txHash);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          groupRows.forEach((r) => onProgress(r.id, "failed"));
          throw new Error(`ERC-1155 multisend failed: ${msg.slice(0, 100)}`);
        }
      }
    }
  }
}

// ── Multicall3From batch helpers (multiple collections) ─────────────────────
// Popup 1: one aggregate3 batching setApprovalForAll for every collection NftMultiSend
//          isn't already approved for. setApprovalForAll is non-payable → no value involved.
async function approveAllCollectionsBatch(
  groups: [string, NftRecipientRow[]][],
  account: Address,
  walletClient: ReturnType<typeof createArcWalletClient>,
  publicClient: ReturnType<typeof createArcPublicClient>
): Promise<`0x${string}` | null> {
  const seen = new Set<string>();
  const calls: { target: Address; allowFailure: boolean; callData: `0x${string}` }[] = [];

  for (const [key] of groups) {
    const [contractAddress, standard] = key.split("::") as [string, NftStandard];
    const addrKey = contractAddress.toLowerCase();
    if (seen.has(addrKey)) continue; // approval is per-contract, dedupe
    seen.add(addrKey);

    const contract = contractAddress as Address;
    const abi = standard === "ERC721" ? ERC721_ABI : ERC1155_ABI;

    const isApproved = (await publicClient.readContract({
      address: contract,
      abi,
      functionName: "isApprovedForAll",
      args: [account, NFT_MULTISEND_ADDRESS],
    })) as boolean;

    if (isApproved) continue;

    calls.push({
      target: contract,
      allowFailure: false,
      callData: encodeFunctionData({
        abi,
        functionName: "setApprovalForAll",
        args: [NFT_MULTISEND_ADDRESS, true],
      }),
    });
  }

  if (calls.length === 0) return null; // every collection already approved — no popup

  const txHash = await walletClient.writeContract({
    address: MULTICALL3FROM_ADDRESS,
    abi: MULTICALL3FROM_ABI,
    functionName: "aggregate3",
    args: [calls],
    account,
    chain: arcTestnet,
    maxFeePerGas: ARC_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// Popup 2: ONE direct call to multisendMixedNFT on the ArcSender contract.
//          Flattens every collection (any mix of ERC-721 / ERC-1155) into parallel
//          arrays and sends them in a single tx. The protocol fee is computed ONCE
//          on the TOTAL recipient count and attached as msg.value — so this single
//          call carries the fee directly (no aggregate3Value needed). Each row is a
//          safeTransferFrom(msg.sender, recipient, …) inside the contract, so the
//          collections must already be approved to ArcSender (handled by popup 1).
async function sendAllTransfersMixed(
  groups: [string, NftRecipientRow[]][],
  account: Address,
  walletClient: ReturnType<typeof createArcWalletClient>,
  _publicClient: ReturnType<typeof createArcPublicClient>
): Promise<`0x${string}`> {
  const standards:  number[]  = [];
  const tokens:     Address[] = [];
  const recipients: Address[] = [];
  const tokenIds:   bigint[]  = [];
  const amounts:    bigint[]  = [];

  for (const [key, groupRows] of groups) {
    const [contractAddress, standard] = key.split("::") as [string, NftStandard];
    const contract = contractAddress as Address;
    const stdCode = standard === "ERC721" ? 0 : 1; // 0 = ERC721, 1 = ERC1155

    for (const row of groupRows) {
      standards.push(stdCode);
      tokens.push(contract);
      recipients.push(row.recipientAddress as Address);
      tokenIds.push(BigInt(row.tokenId));
      // amount is ignored for ERC-721 rows by the contract; pass 1 as a safe default
      amounts.push(standard === "ERC721" ? 1n : BigInt(row.amount || "1"));
    }
  }

  // Fee tier is based on the TOTAL recipient count across all collections.
  const fee = getNftMultisendFee(recipients.length);

  return walletClient.writeContract({
    address: NFT_MULTISEND_ADDRESS,
    abi: NFT_MULTISEND_ABI,
    functionName: "multisendMixedNFT",
    args: [standards, tokens, recipients, tokenIds, amounts],
    account,
    chain: arcTestnet,
    value: fee,
    maxFeePerGas: ARC_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
  });
}

// ---- Helpers ----
function groupNftRows(rows: NftRecipientRow[]): Record<string, NftRecipientRow[]> {
  return rows.reduce(
    (acc, row) => {
      const key = `${row.contractAddress}::${row.standard}`;
      acc[key] = [...(acc[key] || []), row];
      return acc;
    },
    {} as Record<string, NftRecipientRow[]>
  );
}

function groupBy1155ByRecipient(
  rows: NftRecipientRow[]
): Record<string, NftRecipientRow[]> {
  return rows.reduce(
    (acc, row) => {
      const key = row.recipientAddress.toLowerCase();
      acc[key] = [...(acc[key] || []), row];
      return acc;
    },
    {} as Record<string, NftRecipientRow[]>
  );
}
