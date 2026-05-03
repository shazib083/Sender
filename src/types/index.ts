// ============================================================
// Core domain types for Sender MultiSend
// ============================================================

export type TokenSymbol = "USDC" | "EURC" | "ETH";

export interface Token {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  address: string; // contract address (empty string for native ETH)
  logoUrl: string;
  isNative?: boolean;
}

export interface TokenBalance {
  token: Token;
  balance: bigint;
  formatted: string;
  usdValue?: string;
}

// ---- Recipient Row ----
export type RowStatus =
  | "idle"
  | "validating"
  | "valid"
  | "invalid"
  | "pending"
  | "success"
  | "failed";

export interface RecipientRow {
  id: string;
  address: string;
  amount: string; // human-readable, e.g. "10.50"
  tokenSymbol: TokenSymbol;
  status: RowStatus;
  txHash?: string;
  errorMessage?: string;
}

// ---- Batch ----
export type BatchStatus = "draft" | "simulating" | "approving" | "executing" | "done" | "failed";

export interface BatchSummary {
  totalByToken: Record<TokenSymbol, bigint>;
  recipientCount: number;
  estimatedGas?: bigint;
  estimatedGasCostEth?: string;
}

export interface BatchExecution {
  id: string;
  status: BatchStatus;
  rows: RecipientRow[];
  summary: BatchSummary;
  createdAt: Date;
  executedAt?: Date;
  txHash?: string;
  error?: string;
}

// ---- Transaction History ----
export type TxStatus = "pending" | "confirmed" | "failed";

export interface TransactionRecord {
  id: string;
  batchId: string;
  txHash: string;
  status: TxStatus;
  recipientCount: number;
  totalByToken: Record<string, string>; // symbol → human amount
  gasUsed?: string;
  blockNumber?: number;
  timestamp: Date;
  networkName: string;
  from: string;
}

// ---- CSV ----
export interface CsvRow {
  address: string;
  amount: string;
  token?: string;
}

// ---- Address Book ----
export interface AddressBookEntry {
  id: string;
  label: string;
  address: string;
  createdAt: Date;
}

// ---- Blockchain Adapter (plug-in interface) ----
export interface IBlockchainAdapter {
  getTokenBalances(walletAddress: string): Promise<TokenBalance[]>;
  validateAddress(address: string): boolean;
  estimateGas(rows: RecipientRow[]): Promise<bigint>;
  executeBatch(
    rows: RecipientRow[],
    onProgress: (rowId: string, status: RowStatus, txHash?: string) => void
  ): Promise<{ txHash: string; success: boolean }>;
  getTransactionReceipt(txHash: string): Promise<TxReceiptResult>;
}

export interface TxReceiptResult {
  status: TxStatus;
  blockNumber?: number;
  gasUsed?: bigint;
  timestamp?: Date;
}

// ---- Circle SDK Types ----
// NOTE: These are typed interfaces based on Circle's published API docs.
// Replace with official @circle-fin/user-controlled-wallets types when available.

export interface CircleWallet {
  id: string;
  state: "LIVE" | "FROZEN";
  walletSetId: string;
  custodyType: "DEVELOPER" | "ENDUSER";
  address: string;
  blockchain: string;
  accountType: string;
  createDate: string;
}

export interface CircleTokenBalance {
  token: {
    id: string;
    blockchain: string;
    name: string;
    symbol: string;
    decimals: number;
    isNative: boolean;
    tokenAddress?: string;
  };
  amount: string;
  updateDate: string;
}

export interface CircleTransferRequest {
  idempotencyKey: string;
  sourceWalletId: string;
  destinationAddress: string;
  amounts: string[];
  tokenId: string;
  feeLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface CircleTransferResponse {
  id: string;
  state: "INITIATED" | "PENDING_RISK_SCREENING" | "DENIED" | "CONFIRMED" | "COMPLETE" | "FAILED";
  txHash?: string;
  errorCode?: string;
}
