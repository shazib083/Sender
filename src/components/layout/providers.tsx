"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { Toaster } from "react-hot-toast";
import { wagmiConfig } from "@/lib/wagmi-config";
import { useState, useEffect } from "react";

/* ----------------------------------------------------------------
   ThemeInitializer
   Runs once on mount, reads localStorage and applies the correct
   class to <html> before the first paint — no flash of wrong theme.
---------------------------------------------------------------- */
function ThemeInitializer() {
  useEffect(() => {
    const stored = localStorage.getItem("rialo-batch-store");
    let theme: "dark" | "light" = "dark";
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.state?.theme === "light") theme = "light";
      } catch {
        // ignore parse errors
      }
    }
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(theme);
  }, []);

  return null;
}

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
        <ThemeInitializer />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-surface-200)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#34d399", secondary: "var(--color-surface-200)" },
            },
            error: {
              iconTheme: { primary: "#f87171", secondary: "var(--color-surface-200)" },
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}