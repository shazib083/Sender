"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Check } from "lucide-react";
import { useChainId, useSwitchChain } from "wagmi";
import toast from "react-hot-toast";
import { useBatchStore } from "@/lib/store/batch-store";
import { SUPPORTED_CHAIN_METAS, getChainMeta } from "@/lib/blockchain/provider";
import { useDefaultChain } from "@/lib/hooks/use-default-chain";
import { cn } from "@/components/ui/utils";

/**
 * Network switcher shown in the header (where the Faucet button used to be).
 * Lists every chain in SUPPORTED_CHAIN_METAS (Arc only today) with its icon on
 * the LEFT of the name. Selecting a chain switches the wallet to it.
 * Arc is forced as the default on first connect via useDefaultChain().
 */
export function NetworkSwitchButton() {
  const { theme } = useBatchStore();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  // Force Arc as the default network on the first wallet connection.
  useDefaultChain();

  const active = getChainMeta(chainId);

  const handleSelect = (targetId: number) => {
    if (targetId === chainId) return;
    switchChain(
      { chainId: targetId },
      { onError: (e) => toast.error(e.message ?? "Failed to switch network") }
    );
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "flex h-8 items-center gap-2 rounded-xl border px-2.5 text-sm transition-colors",
            theme === "light"
              ? "border-[#d6d0c0] bg-transparent text-[#2a2a27] hover:bg-surface-200"
              : "border-surface-400 bg-transparent text-gray-200 hover:border-brand-500"
          )}
          aria-label="Switch network"
        >
          <img
            src={active.iconUrl}
            alt={active.label}
            className="h-4 w-4 shrink-0 rounded-full object-contain"
          />
          <span className="hidden sm:inline">{active.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[180px] rounded-xl border border-surface-400 bg-surface-100 p-1 shadow-xl animate-slide-up"
          align="end"
          sideOffset={6}
        >
          <div className="px-3 py-2 border-b border-surface-300 mb-1">
            <p className="text-xs text-gray-500">Select network</p>
          </div>

          {SUPPORTED_CHAIN_METAS.map((m) => {
            const isActive = m.chain.id === chainId;
            return (
              <DropdownMenu.Item
                key={m.chain.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none",
                  "text-gray-300 hover:bg-surface-300 hover:text-white",
                  isPending && "opacity-60 pointer-events-none"
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  handleSelect(m.chain.id);
                }}
              >
                {/* Icon on the LEFT of the network name */}
                <img
                  src={m.iconUrl}
                  alt={m.label}
                  className="h-5 w-5 shrink-0 rounded-full object-contain"
                />
                <span className="flex-1">{m.label}</span>
                {isActive && <Check className="h-4 w-4 text-emerald-400" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
