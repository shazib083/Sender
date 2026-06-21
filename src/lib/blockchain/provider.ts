// ============================================================
// lib/blockchain/provider.ts
// Chain configuration & provider utilities.
//
// Arc Testnet is the only supported chain. To add more chains later, define
// them here, add their env vars, and append to SUPPORTED_CHAIN_METAS.
// ============================================================

import { type Chain } from "viem";
import { createPublicClient, createWalletClient, http, custom } from "viem";

// ---- Arc Testnet Chain Definition (DEFAULT) ----
export const arcTestnet: Chain = {
  id: Number(process.env.NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID ?? 5042002),
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

// ---- Chain metadata for UI (label + icon shown in the network switcher) ----
// Icons are served from the /public folder (Arc.png).
export interface ChainMeta {
  chain: Chain;
  label: string;
  iconUrl: string;
}

export const ARC_CHAIN_META: ChainMeta = {
  chain: arcTestnet,
  label: "Arc",
  iconUrl: "/Arc.png",
};

// Order here = order in the dropdown. Arc is the only supported network.
export const SUPPORTED_CHAIN_METAS: ChainMeta[] = [ARC_CHAIN_META];

// Arc is the default chain the wallet is forced onto when it first connects.
export const DEFAULT_CHAIN: Chain = arcTestnet;

export function getChainMeta(chainId?: number): ChainMeta {
  return SUPPORTED_CHAIN_METAS.find((m) => m.chain.id === chainId) ?? ARC_CHAIN_META;
}

export function isSupportedChain(chainId?: number): boolean {
  return SUPPORTED_CHAIN_METAS.some((m) => m.chain.id === chainId);
}

// ---- Public Client (read-only, server & client) — Arc by default ----
export function createArcPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(arcTestnet.rpcUrls.default.http[0]),
  });
}

// ---- Wallet Client (browser-side, requires window.ethereum) — Arc context ----
export function createArcWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found. Please install MetaMask.");
  }
  return createWalletClient({
    chain: arcTestnet,
    transport: custom(window.ethereum),
  });
}

// ---- Switch / Add a chain in MetaMask (defaults to Arc) ----
export async function switchToChain(chain: Chain = arcTestnet): Promise<void> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not found");
  }

  const chainIdHex = `0x${chain.id.toString(16)}`;

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
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls.default.http,
            blockExplorerUrls: [chain.blockExplorers?.default.url],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

// Backwards-compatible helper (Arc).
export async function switchToArcTestnet(): Promise<void> {
  return switchToChain(arcTestnet);
}

// ---- Explorer helpers (chain-aware, default Arc) ----
export function getExplorerTxUrl(txHash: string, chainId?: number): string {
  const url = getChainMeta(chainId).chain.blockExplorers?.default.url;
  return `${url}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string, chainId?: number): string {
  const url = getChainMeta(chainId).chain.blockExplorers?.default.url;
  return `${url}/address/${address}`;
}
