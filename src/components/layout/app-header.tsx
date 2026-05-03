"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, LayoutDashboard, History, BookOpen } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button";
import { useBatchStore } from "@/lib/store/batch-store";
import { truncateAddress } from "@/lib/utils/validation";
import { WalletConnectButton } from "./wallet-connect-button";

const NAV_LINKS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/history", label: "History", icon: History },
  { href: "/app/docs", label: "Docs", icon: BookOpen },
];

export function AppHeader() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { theme, toggleTheme } = useBatchStore();

  return (
    <header className="sticky top-0 z-50 border-b border-surface-300 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 shadow-glow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Sender
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-surface-300 text-white"
                  : "text-gray-400 hover:text-white hover:bg-surface-200"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-200 hover:text-white transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
