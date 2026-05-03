"use client";

import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { TokenBalanceCards } from "@/components/dashboard/token-balance-cards";
import { RecipientsTable } from "@/components/dashboard/recipients-table";
import { SummaryPanel } from "@/components/dashboard/summary-panel";
import { WalletConnectButton } from "@/components/layout/wallet-connect-button";
import { AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const { isConnected } = useAccount();

  // ✅ hydration guard (fixes SSR mismatch)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent server/client mismatch
  if (!mounted) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-24 rounded-2xl bg-surface-100/20 animate-pulse" />
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="h-[400px] rounded-2xl bg-surface-100/20 animate-pulse" />
          <div className="h-[400px] rounded-2xl bg-surface-100/20 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Not connected banner */}
      {!isConnected && (
        <div className="flex items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">
              Wallet not connected
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Connect your wallet to view balances and execute batch transfers.
            </p>
          </div>
          <WalletConnectButton />
        </div>
      )}

      {/* Token balances */}
      {isConnected && <TokenBalanceCards />}

      {/* Main layout: table + summary */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <RecipientsTable />
        <SummaryPanel />
      </div>
    </div>
  );
}
