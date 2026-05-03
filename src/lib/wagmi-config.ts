// ============================================================
// lib/wagmi-config.ts
// wagmi v2 + WalletConnect configuration
// ============================================================

import { http, createConfig } from "wagmi";
import { metaMask, walletConnect, injected } from "wagmi/connectors";
import { arcTestnet } from "./blockchain/provider";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_WALLETCONNECT_PROJECT_ID";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId,
      metadata: {
        name: "Sender MultiSend",
        description: "Batch token distribution on Arc Testnet",
        url: process.env.NEXT_PUBLIC_APP_URL ?? "https://Sender.io",
        icons: ["/logo.png"],
      },
    }),
  ],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
