"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { Wallet, ChevronDown, LogOut, Copy, Check, ExternalLink, AlertTriangle, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { truncateAddress } from "@/lib/utils/validation";
import { getExplorerAddressUrl, arcTestnet, getChainMeta, isSupportedChain } from "@/lib/blockchain/provider";
import toast from "react-hot-toast";

export function WalletConnectButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const displayName = address ? truncateAddress(address) : "";
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure portal only renders client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const isWrongNetwork = isConnected && !isSupportedChain(chainId);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Address copied");
  };

  // ---- Modal rendered via Portal directly on document.body ----
  const modal =
    mounted && showModal
      ? createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setShowModal(false)}
          >
            <div
              style={{ position: "relative" }}
              className="w-full max-w-sm mx-4 rounded-2xl border border-surface-400 bg-surface-100 p-6 shadow-2xl animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-500 hover:bg-surface-300 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <h2 className="mb-1 text-lg font-semibold text-white">Connect Wallet</h2>
              <p className="mb-5 text-sm text-gray-400">Choose your preferred wallet provider</p>

              <div className="flex flex-col gap-3">
                {/* MetaMask */}
                <button
                  onClick={() => {
                    const mm = connectors.find(
                      (c) => c.name === "MetaMask" || c.name === "Injected"
                    );
                    connect({ connector: mm ?? connectors[0] });
                    setShowModal(false);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-surface-400 bg-surface-200 p-3.5 text-sm text-gray-200 hover:border-brand-500 hover:bg-surface-300 transition-all text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden bg-white">
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                        alt="MetaMask"
                        className="h-7 w-7 object-contain"
                      />
                  </div>
                  <div>
                    <div className="font-medium text-white">MetaMask</div>
                    <div className="text-xs text-gray-500">Browser extension wallet</div>
                  </div>
                </button>

                {/* WalletConnect */}
                <button
                  onClick={() => {
                    const wc = connectors.find((c) => c.name === "WalletConnect");
                    if (wc) {
                      connect({ connector: wc });
                      setShowModal(false);
                    } else {
                      toast.error("Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to env vars");
                    }
                  }}
                  className="flex items-center gap-3 rounded-xl border border-surface-400 bg-surface-200 p-3.5 text-sm text-gray-200 hover:border-brand-500 hover:bg-surface-300 transition-all text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600">
                    <svg viewBox="0 0 300 185" className="h-5 w-5" fill="white">
                      <path d="M61.4 36.3C110.3-8.4 188.6-8.4 237.6 36.3L243.1 41.6C245.6 43.9 245.6 47.6 243.1 49.8L224.3 67.7C223 68.8 221 68.8 219.8 67.7L212.1 60.4C178 28.6 121 28.6 86.9 60.4L78.6 68.2C77.4 69.3 75.4 69.3 74.2 68.2L55.3 50.3C52.8 48 52.8 44.3 55.3 42.1L61.4 36.3ZM279.3 74.4L296.2 90.3C298.7 92.6 298.7 96.3 296.2 98.6L222.4 168.1C219.9 170.3 215.9 170.3 213.5 168.1L161 118.7C160.4 118.1 159.4 118.1 158.8 118.7L106.3 168.1C103.9 170.3 99.8 170.3 97.4 168.1L23.6 98.6C21.1 96.3 21.1 92.6 23.6 90.3L40.5 74.4C43 72.1 47 72.1 49.4 74.4L101.9 123.8C102.5 124.3 103.5 124.3 104.2 123.8L156.6 74.4C159.1 72.1 163.1 72.1 165.6 74.4L218 123.8C218.7 124.3 219.7 124.3 220.3 123.8L272.8 74.4C275.2 72.1 279.2 72.1 279.3 74.4Z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-white">WalletConnect</div>
                    <div className="text-xs text-gray-500">QR code or mobile wallet</div>
                  </div>
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-gray-600">
                By connecting, you agree to our Terms of Service
              </p>
            </div>
          </div>,
          document.body
        )
      : null;

  // ---- Not connected ----
  if (!isConnected) {
    return (
      <>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowModal(true)}
          loading={isConnecting}
          className="h-8 w-8 px-0 sm:w-auto sm:px-3"
          aria-label="Connect wallet"
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">Connect Wallet</span>
        </Button>
        {modal}
      </>
    );
  }

  // ---- Wrong network ----
  if (isWrongNetwork) {
    return (
      <Button
        variant="danger"
        size="sm"
        onClick={() => switchChain({ chainId: arcTestnet.id })}
        className="h-8 w-8 px-0 sm:w-auto sm:px-3"
        aria-label="Switch to Arc"
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="hidden sm:inline">Switch to Arc</span>
      </Button>
    );
  }

  // ---- Connected ----
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center gap-2 rounded-xl border border-surface-400 bg-surface-200 px-0 text-sm text-gray-200 hover:border-brand-500 transition-colors sm:w-auto sm:px-3"
          aria-label="Wallet menu"
        >
          <Wallet className="h-4 w-4 sm:hidden" />
          <span className="hidden h-2 w-2 rounded-full bg-emerald-400 sm:block" />
          <span className="hidden sm:inline">{displayName}</span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-gray-500 sm:block" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] rounded-xl border border-surface-400 bg-surface-100 p-1 shadow-xl animate-slide-up"
          align="end"
          sideOffset={6}
        >
          <div className="px-3 py-2 border-b border-surface-300 mb-1">
            <p className="text-xs text-gray-500">Connected to {getChainMeta(chainId).chain.name}</p>
            <p className="font-mono text-sm text-white mt-0.5">
              {displayName}
            </p>
          </div>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none hover:bg-surface-300 hover:text-white"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy address
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none hover:bg-surface-300 hover:text-white"
            onClick={() =>
              window.open(getExplorerAddressUrl(address ?? "", chainId), "_blank")
            }
          >
            <ExternalLink className="h-4 w-4" />
            View on explorer
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-surface-300" />

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 outline-none hover:bg-red-500/10"
            onClick={() => disconnect()}
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
