// ============================================================
// lib/hooks/use-permit2-setup.tsx
//
// Run one-time Permit2 approvals at WALLET CONNECT time,
// not during batch execution. This way by the time the user
// clicks "Execute Batch", setup is already done.
//
// Import and call this hook in your wallet connect component
// or in the main app layout after wallet connects.
// ============================================================

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { maxUint256, type Address } from "viem";
import { createArcPublicClient, createArcWalletClient, arcTestnet } from "@/lib/blockchain/provider";
import { ERC20_ABI, TOKEN_REGISTRY } from "@/lib/blockchain/tokens";
import { parseGwei } from "viem";

const PERMIT2_ADDRESS: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const ARC_MAX_FEE_PER_GAS      = parseGwei("200");
const ARC_MAX_PRIORITY_FEE     = parseGwei("1");

export type SetupStatus = "idle" | "checking" | "approving" | "done";

export function usePermit2Setup() {
  const { address, isConnected } = useAccount();
  const [status, setStatus]      = useState<SetupStatus>("idle");
  const [tokensRemaining, setTokensRemaining] = useState(0);

  useEffect(() => {
    if (!isConnected || !address) {
      setStatus("idle");
      return;
    }
    // Run setup automatically when wallet connects
    runSetup(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  async function runSetup(account: Address) {
    try {
      setStatus("checking");
      const publicClient = createArcPublicClient();
      const walletClient = createArcWalletClient();

      // Check all tokens in registry
      const allTokens = Object.values(TOKEN_REGISTRY);
      const needsApproval: Address[] = [];

      for (const token of allTokens) {
        const allowance = (await publicClient.readContract({
          address:      token.address as Address,
          abi:          ERC20_ABI,
          functionName: "allowance",
          args:         [account, PERMIT2_ADDRESS],
        })) as bigint;

        if (allowance < maxUint256 / 2n) {
          needsApproval.push(token.address as Address);
        }
      }

      if (needsApproval.length === 0) {
        // All tokens already approved — user will see 0 setup popups
        setStatus("done");
        return;
      }

      // Approve each token that needs it
      setStatus("approving");
      setTokensRemaining(needsApproval.length);

      for (const tokenAddress of needsApproval) {
        const txHash = await walletClient.writeContract({
          address:              tokenAddress,
          abi:                  ERC20_ABI,
          functionName:         "approve",
          args:                 [PERMIT2_ADDRESS, maxUint256],
          account,
          chain:                arcTestnet,
          maxFeePerGas:         ARC_MAX_FEE_PER_GAS,
          maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setTokensRemaining((n) => n - 1);
      }

      setStatus("done");
    } catch (err) {
      console.error("Permit2 setup error:", err);
      setStatus("idle"); // reset so user can retry
    }
  }

  return { status, tokensRemaining };
}