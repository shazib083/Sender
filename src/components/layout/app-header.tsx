"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, LayoutDashboard, History, BookOpen } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useBatchStore } from "@/lib/store/batch-store";
import { WalletConnectButton } from "./wallet-connect-button";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/app",              label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/history",      label: "History",   icon: History          },
  { href: "/app/docs",         label: "Docs",      icon: BookOpen         },
];

export function AppHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useBatchStore();

  // Keep <html> class in sync whenever the toggle fires
  const handleToggle = () => {
    toggleTheme();
    const next = theme === "dark" ? "light" : "dark";
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(next);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-surface-300 backdrop-blur-md transition-colors duration-300"
      style={{ backgroundColor: theme === "light" ? "rgba(232,227,213,0.92)" : undefined }}
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden shadow-glow-sm">
             <img src="/logo.png" alt="Sender logo" className="h-8 w-8" />
          </div>
          <span className={theme === "light" ? "text-[#2a2a27] font-bold" : "gradient-text"}>Sender</span>
        </Link>


        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
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
          {/* Theme toggle */}
          <button
            onClick={handleToggle}
            className={cn(
              "rounded-lg p-2 transition-all duration-200",
              "hover:bg-surface-200",
              theme === "light"
                ? "text-[#6d6d67] hover:text-[#2a2a27]"
                : "text-gray-400 hover:text-white"
            )}
            aria-label="Toggle theme"
          >
            {theme === "dark"
              ? <Sun  className="h-4 w-4" />
              : <Moon className="h-4 w-4" />
            }
          </button>

          {/* Faucet Button */}
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
          >
            <Button variant="primary" size="md" style={{ minWidth: 90, letterSpacing: '0.04em' }}>
              Faucet
            </Button>
          </a>

          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
