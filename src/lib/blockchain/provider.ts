// ============================================================
// lib/blockchain/provider.ts
// Arc Testnet chain configuration & provider utilities
// ============================================================
// NOTE: Arc testnet RPC and chain ID are loaded from env vars.
// Update NEXT_PUBLIC_ARC_TESTNET_RPC_URL and
// NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID in .env.local once confirmed
// from https://docs.arc.network/
// ============================================================

import { type Chain } from "viem";
import { createPublicClient, createWalletClient, http, custom } from "viem";

// ---- Arc Testnet Chain Definition ----
export const arcTestnet: Chain = {
  id: parseInt(process.env.NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID ?? "12321", 10),
  name: "Arc Testnet",
  nativeCurrency: {
    name: "ARC",
    symbol: "ARC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "https://rpc.arc-testnet.network"],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "https://rpc.arc-testnet.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://explorer.arc-testnet.network",
    },
  },
  testnet: true,
};

// ---- Public Client (read-only, server & client) ----
export function createArcPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(arcTestnet.rpcUrls.default.http[0]),
  });
}

// ---- Wallet Client (browser-side, requires window.ethereum) ----
export function createArcWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found. Please install MetaMask.");
  }
  return createWalletClient({
    chain: arcTestnet,
    transport: custom(window.ethereum),
  });
}

// ---- Switch / Add Arc Testnet in MetaMask ----
export async function switchToArcTestnet(): Promise<void> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not found");
  }

  const chainIdHex = `0x${arcTestnet.id.toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: unknown) {
    // Chain not added yet — add it
    const err = switchError as { code?: number };
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: arcTestnet.name,
            nativeCurrency: arcTestnet.nativeCurrency,
            rpcUrls: arcTestnet.rpcUrls.default.http,
            blockExplorerUrls: [arcTestnet.blockExplorers?.default.url],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

// ---- Helpers ----
export function getExplorerTxUrl(txHash: string): string {
  return `${arcTestnet.blockExplorers?.default.url}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${arcTestnet.blockExplorers?.default.url}/address/${address}`;
}
