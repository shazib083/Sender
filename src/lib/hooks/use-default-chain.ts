"use client";
import { useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { DEFAULT_CHAIN } from "@/lib/blockchain/provider";

/**
 * Forces the wallet onto the DEFAULT chain (Arc) the first time it connects.
 *
 * - Runs once per connection: when the wallet transitions to connected, if it
 *   is not already on Arc, it requests a switch to Arc.
 * - After that initial force, the user's manual network choices (via the
 *   network dropdown) are fully respected — this hook will not fight them.
 * - The "already forced" flag resets on disconnect so the next connection is
 *   forced back to Arc again.
 */
export function useDefaultChain() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const forcedRef = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      forcedRef.current = false; // reset for the next fresh connection
      return;
    }

    if (!forcedRef.current) {
      forcedRef.current = true;
      if (chainId !== DEFAULT_CHAIN.id) {
        try {
          switchChain?.({ chainId: DEFAULT_CHAIN.id });
        } catch {
          /* user may reject — the wallet-connect button shows a fallback */
        }
      }
    }
  }, [isConnected, chainId, switchChain]);
}
