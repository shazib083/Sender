"use client";

import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { TokenBalanceCards } from "@/components/dashboard/token-balance-cards";
import { RecipientsTable } from "@/components/dashboard/recipients-table";
import { SummaryPanel } from "@/components/dashboard/summary-panel";
import { NftRecipientsTable } from "@/components/dashboard/nft-recipients-table";
import { NftSummaryPanel } from "@/components/dashboard/nft-summary-panel";
import { WalletNFTHoldings } from "@/components/dashboard/wallet-nft-holdings";
import { AlertTriangle, Coins, ImageIcon } from "lucide-react";
import { cn } from "@/components/ui/utils";

type ActiveTab = "token" | "nft";

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("token");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent server/client mismatch
  if (!mounted) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-12 rounded-2xl bg-surface-100/20 animate-pulse" />
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

      {/* ── Wallet not connected banner ── */}
      {!isConnected && (
        <div className="flex items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300 [html.light_&]:text-[#2a2a27]">
              Wallet not connected
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5 [html.light_&]:text-[#6d6d67]">
              Connect your wallet using the button in the top right corner.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab switcher ── */}
      <div className="flex items-center gap-1 rounded-xl border border-surface-300 bg-surface-200 p-1 w-fit">
        <button
          onClick={() => setActiveTab("token")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200",
            activeTab === "token"
              ? "bg-brand-600 text-white shadow-glow-sm"
              : "text-gray-400 hover:text-white hover:bg-surface-300"
          )}
        >
          <Coins className="h-4 w-4" />
          Token
        </button>
        <button
          onClick={() => setActiveTab("nft")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200",
            activeTab === "nft"
              ? "bg-brand-600 text-white shadow-glow-sm"
              : "text-gray-400 hover:text-white hover:bg-surface-300"
          )}
        >
          <ImageIcon className="h-4 w-4" />
          NFT
        </button>
      </div>

      {/* ── TOKEN TAB ── */}
      {activeTab === "token" && (
        <>
          {/* Token balances */}
          {isConnected && <TokenBalanceCards />}

          {/* Main layout: recipients table + summary */}
          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <RecipientsTable />
            <SummaryPanel />
          </div>
        </>
      )}

      {/* ── NFT TAB ── */}
      {activeTab === "nft" && (
        <>
          {/* Main layout: NFT recipients table + holdings + summary panel */}
          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <NftRecipientsTable />
              {isConnected && <WalletNFTHoldings />}
            </div>
            <NftSummaryPanel />
          </div>
        </>
      )}
    </div>
  );
}