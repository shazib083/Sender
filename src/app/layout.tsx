import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} bg-surface text-gray-100 antialiased min-h-screen`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
