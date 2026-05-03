import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

export const metadata: Metadata = {
  title: "Sender MultiSend — Batch Token Distribution",
  description:
    "Send tokens to hundreds of wallets in a single transaction. Built for Arc Testnet with Circle USDC & EURC.",
  keywords: ["multisend", "batch transfer", "USDC", "EURC", "Arc testnet", "Circle"],
  openGraph: {
    title: "Sender MultiSend",
    description: "Batch token distribution on Arc Testnet",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-surface-DEFAULT text-gray-100 antialiased min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}