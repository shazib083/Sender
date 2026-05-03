// ============================================================
// lib/blockchain/circle-adapter.ts
// Circle SDK plug-in adapter
// ============================================================
// IMPORTANT: This adapter wraps Circle's Developer-Controlled
// Wallets API. Replace the fetch-based implementation with the
// official @circle-fin/developer-controlled-wallets SDK once
// it is installed and configured.
//
// Required env vars:
//   CIRCLE_API_KEY
//   CIRCLE_WALLET_SET_ID
//   CIRCLE_ENTITY_SECRET
//   NEXT_PUBLIC_CIRCLE_APP_ID
//
// All these are SERVER-SIDE only (except NEXT_PUBLIC_CIRCLE_APP_ID).
// Do NOT expose CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET to the browser.
// ============================================================

import {
  type CircleWallet,
  type CircleTokenBalance,
  type CircleTransferRequest,
  type CircleTransferResponse,
} from "@/types";

const CIRCLE_BASE_URL = "https://api.circle.com/v1/w3s";

// ---- Server-side Circle API client ----
// NOTE: Only call these from Next.js Server Actions or API Routes.

function circleHeaders(): HeadersInit {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error("CIRCLE_API_KEY is not set. See .env.example for setup instructions.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

// ---- Wallet operations ----
export async function getCircleWallets(): Promise<CircleWallet[]> {
  // CIRCLE SDK NOTE: Replace with:
  //   const { data } = await circleDeveloperSdk.listWallets({ walletSetId: WALLET_SET_ID })
  const res = await fetch(
    `${CIRCLE_BASE_URL}/wallets?walletSetId=${process.env.CIRCLE_WALLET_SET_ID}`,
    { headers: circleHeaders(), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Circle API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return (json.data?.wallets ?? []) as CircleWallet[];
}

export async function getCircleWalletBalances(
  walletId: string
): Promise<CircleTokenBalance[]> {
  // CIRCLE SDK NOTE: Replace with:
  //   const { data } = await circleDeveloperSdk.getWalletTokenBalance({ id: walletId })
  const res = await fetch(
    `${CIRCLE_BASE_URL}/wallets/${walletId}/balances`,
    { headers: circleHeaders(), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Circle API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return (json.data?.tokenBalances ?? []) as CircleTokenBalance[];
}

// ---- Transfer operations ----
export async function createCircleTransfer(
  request: CircleTransferRequest
): Promise<CircleTransferResponse> {
  // CIRCLE SDK NOTE: Replace with:
  //   const { data } = await circleDeveloperSdk.createTransaction({ ... })
  const res = await fetch(`${CIRCLE_BASE_URL}/developer/transactions/transfer`, {
    method: "POST",
    headers: circleHeaders(),
    body: JSON.stringify({
      idempotencyKey: request.idempotencyKey,
      walletId: request.sourceWalletId,
      destinationAddress: request.destinationAddress,
      amounts: request.amounts,
      tokenId: request.tokenId,
      feeLevel: request.feeLevel,
      // For Arc testnet, ensure the wallet is configured for the right blockchain
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Circle transfer failed: ${res.status} — ${JSON.stringify(err)}`
    );
  }
  const json = await res.json();
  return json.data as CircleTransferResponse;
}

export async function getCircleTransferStatus(
  transferId: string
): Promise<CircleTransferResponse> {
  const res = await fetch(
    `${CIRCLE_BASE_URL}/developer/transactions/${transferId}`,
    { headers: circleHeaders(), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Circle API error: ${res.status}`);
  }
  const json = await res.json();
  return json.data as CircleTransferResponse;
}

// ---- Entity Secret encryption (for Circle ciphertext) ----
// CIRCLE SDK NOTE: This is required for developer-controlled wallets.
// The entity secret must be encrypted using Circle's public RSA key
// before being sent. Use the official SDK which handles this automatically.
//
// Manual implementation (if needed without SDK):
//
// import crypto from "crypto"
// export async function encryptEntitySecret(entitySecret: string, circlePublicKey: string): Promise<string> {
//   const entitySecretBytes = Buffer.from(entitySecret, "hex")
//   const publicKey = crypto.createPublicKey(circlePublicKey)
//   const encrypted = crypto.publicEncrypt(
//     { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
//     entitySecretBytes
//   )
//   return encrypted.toString("base64")
// }

// ---- Token ID mapping for Arc Testnet ----
// CIRCLE SDK NOTE: Circle uses internal token IDs, not contract addresses.
// These must be retrieved from Circle's token catalog for the Arc testnet blockchain.
// Once you have them, add them here:
export const CIRCLE_TOKEN_IDS: Record<string, string> = {
  // Example: "USDC": "circle-token-id-for-usdc-on-arc-testnet"
  // Update these after fetching from: GET /v1/w3s/token/catalog?blockchain=ARC-TESTNET
  USDC: process.env.CIRCLE_USDC_TOKEN_ID ?? "PLACEHOLDER_CIRCLE_USDC_TOKEN_ID",
  EURC: process.env.CIRCLE_EURC_TOKEN_ID ?? "PLACEHOLDER_CIRCLE_EURC_TOKEN_ID",
};

// ---- Arc Testnet blockchain identifier for Circle ----
// CIRCLE SDK NOTE: Confirm correct blockchain string from Circle's docs:
// https://developers.circle.com/w3s/docs/supported-blockchains
export const CIRCLE_ARC_BLOCKCHAIN = "ARC-TESTNET"; // ⚠️ Confirm this value
