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
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        {/* Inline script runs BEFORE React — reads localStorage and sets
            the correct theme class immediately, preventing any flash.
            Default is "light" if nothing is stored yet.             */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('rialo-batch-store');
                  var theme = 'light';
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed && parsed.state && parsed.state.theme) {
                      theme = parsed.state.theme;
                    }
                  }
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(theme);
                } catch(e) {
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="bg-surface text-gray-100 antialiased min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}