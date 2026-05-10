// ============================================================
// types/nft.ts
// Core domain types for NFT bulk sending
// ============================================================

export type NftStandard = "ERC721" | "ERC1155";

export type NftRowStatus =
  | "idle"
  | "validating"
  | "valid"
  | "invalid"
  | "pending"
  | "success"
  | "failed";

export type NftBatchStatus =
  | "draft"
  | "simulating"
  | "executing"
  | "done"
  | "failed";

export interface NftRecipientRow {
  id: string;
  contractAddress: string;
  tokenId: string;
  amount: string; // always "1" for ERC721, user-defined for ERC1155
  standard: NftStandard;
  recipientAddress: string;
  status: NftRowStatus;
  txHash?: string;
  errorMessage?: string;
}

export interface NftBatchSummary {
  totalByContract: Record<string, number>;
  recipientCount: number;
}