"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { Toaster } from "react-hot-toast";
import { wagmiConfig } from "@/lib/wagmi-config";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 2,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1c1f2e",
              color: "#e5e7eb",
              border: "1px solid #373b58",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#34d399", secondary: "#1c1f2e" },
            },
            error: {
              iconTheme: { primary: "#f87171", secondary: "#1c1f2e" },
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
