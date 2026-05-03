"use client";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { metaMask, walletConnect } from "wagmi/connectors";
import { Wallet, ChevronDown, LogOut, Copy, Check, ExternalLink, AlertTriangle } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { truncateAddress } from "@/lib/utils/validation";
import { getExplorerAddressUrl, arcTestnet } from "@/lib/blockchain/provider";
import toast from "react-hot-toast";

export function WalletConnectButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const isWrongNetwork = isConnected && chainId !== arcTestnet.id;

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Address copied");
  };

  if (!isConnected) {
    return (
      <>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowModal(true)}
          loading={isConnecting}
        >
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>

        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-surface-400 bg-surface-100 p-6 shadow-2xl animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-1 text-lg font-semibold text-white">Connect Wallet</h2>
              <p className="mb-5 text-sm text-gray-400">Choose your preferred wallet provider</p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    const mm = connectors.find((c) => c.name === "MetaMask" || c.name === "Injected");
                    connect({ connector: mm ?? connectors[0] });
                    setShowModal(false);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-surface-400 bg-surface-200 p-3.5 text-sm text-gray-200 hover:border-brand-500 hover:bg-surface-300 transition-all"
                >
                  <img src="/metamask.svg" alt="MetaMask" className="h-8 w-8" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <div className="text-left">
                    <div className="font-medium text-white">MetaMask</div>
                    <div className="text-xs text-gray-500">Browser extension wallet</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const wc = connectors.find((c) => c.name === "WalletConnect");
                    if (wc) { connect({ connector: wc }); setShowModal(false); }
                    else { alert("WalletConnect not configured. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to .env.local"); }
                  }}
                  className="flex items-center gap-3 rounded-xl border border-surface-400 bg-surface-200 p-3.5 text-sm text-gray-200 hover:border-brand-500 hover:bg-surface-300 transition-all"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                    <svg viewBox="0 0 300 185" className="h-5 w-5" fill="white">
                      <path d="M61.4385 36.2562C110.349 -8.42027 188.643 -8.42027 237.553 36.2562L243.142 41.582C245.592 43.862 245.592 47.568 243.142 49.848L224.254 67.674C223.029 68.814 221.026 68.814 219.801 67.674L212.117 60.43C178.014 28.5502 120.978 28.5502 86.875 60.43L78.6376 68.154C77.4126 69.294 75.4097 69.294 74.1847 68.154L55.2963 50.328C52.8465 48.048 52.8465 44.342 55.2963 42.062L61.4385 36.2562ZM279.304 74.3729L296.236 90.312C298.686 92.592 298.686 96.298 296.236 98.578L222.427 168.067C219.977 170.347 215.971 170.347 213.521 168.067L161.026 118.668C160.414 118.098 159.412 118.098 158.8 118.668L106.305 168.067C103.855 170.347 99.8494 170.347 97.3995 168.067L23.5904 98.578C21.1406 96.298 21.1406 92.592 23.5904 90.312L40.5222 74.3729C42.972 72.0929 46.9779 72.0929 49.4277 74.3729L101.924 123.772C102.536 124.342 103.538 124.342 104.15 123.772L156.645 74.3729C159.095 72.0929 163.101 72.0929 165.551 74.3729L218.047 123.772C218.659 124.342 219.661 124.342 220.273 123.772L272.769 74.3729C275.218 72.0929 279.224 72.0929 279.304 74.3729Z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">WalletConnect</div>
                    <div className="text-xs text-gray-500">QR code or mobile wallet</div>
                  </div>
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-gray-600">
                By connecting, you agree to our Terms of Service
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  if (isWrongNetwork) {
    return (
      <Button
        variant="danger"
        size="sm"
        onClick={() => switchChain({ chainId: arcTestnet.id })}
      >
        <AlertTriangle className="h-4 w-4" />
        Switch to Arc
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 rounded-xl border border-surface-400 bg-surface-200 px-3 py-2 text-sm text-gray-200 hover:border-brand-500 transition-colors">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {truncateAddress(address ?? "")}
          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] rounded-xl border border-surface-400 bg-surface-100 p-1 shadow-xl animate-slide-up"
          align="end"
          sideOffset={6}
        >
          <div className="px-3 py-2 border-b border-surface-300 mb-1">
            <p className="text-xs text-gray-500">Connected to Arc Testnet</p>
            <p className="font-mono text-sm text-white mt-0.5">{truncateAddress(address ?? "", 6)}</p>
          </div>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none hover:bg-surface-300 hover:text-white"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            Copy address
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none hover:bg-surface-300 hover:text-white"
            onClick={() => window.open(getExplorerAddressUrl(address ?? ""), "_blank")}
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
