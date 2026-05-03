// ============================================================
// lib/blockchain/provider.ts
// Arc Testnet chain configuration & provider utilities
// ============================================================

import { type Chain } from "viem";
import { createPublicClient, createWalletClient, http, custom } from "viem";

// ---- Arc Testnet Chain Definition ----
export const arcTestnet: Chain = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network"],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://testnet.arcscan.app",
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