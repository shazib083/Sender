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
    try {
      const stored = localStorage.getItem("rialo-batch-store");
      if (!stored) {
        // No stored value at all — write light as default so Zustand
        // rehydrates correctly on the next render
        const initial = { state: { theme: "light" }, version: 0 };
        localStorage.setItem("rialo-batch-store", JSON.stringify(initial));
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add("light");
        return;
      }

      const parsed = JSON.parse(stored);
      const savedTheme = parsed?.state?.theme;

      // If theme key is missing entirely, inject "light"
      if (!savedTheme) {
        parsed.state = { ...parsed.state, theme: "light" };
        localStorage.setItem("rialo-batch-store", JSON.stringify(parsed));
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add("light");
        return;
      }

      // Valid saved preference — apply it
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(savedTheme);
    } catch {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add("light");
    }
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