// ============================================================
// lib/wagmi-config.ts
// wagmi v2 + WalletConnect configuration (multi-chain)
// ============================================================

import { http, createConfig } from "wagmi";
import { metaMask, walletConnect, injected } from "wagmi/connectors";
import { arcTestnet, sepolia } from "./blockchain/provider";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_WALLETCONNECT_PROJECT_ID";

export const wagmiConfig = createConfig({
  // Arc first => default chain. Sepolia added for future multi-chain support.
  chains: [arcTestnet, sepolia],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId,
      metadata: {
        name: "Sender MultiSend",
        description: "Batch token distribution on Arc Testnet",
        url: process.env.NEXT_PUBLIC_APP_URL ?? "https://Sender.io",
        icons: [`${process.env.NEXT_PUBLIC_APP_URL ?? "https://Sender.io"}/logo.png`],
      },
    }),
  ],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
    [sepolia.id]:    http(sepolia.rpcUrls.default.http[0]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
