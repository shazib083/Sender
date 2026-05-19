// lib/hooks/use-arc-name.ts
// Resolves a wallet address to its .arc name via ArcNameHub

import { useReadContract } from 'wagmi'

const ARC_NAME_HUB = '0x1975252e53f342a40D6D22403b7E5D1e0d2a7F1f'

const ABI = [
  {
    name: 'reverseLookup',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'string' }],
  },
] as const

export function useArcName(address?: string) {
  const { data: arcName, isLoading } = useReadContract({
    address: ARC_NAME_HUB,
    abi: ABI,
    functionName: 'reverseLookup',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  })

  const displayName = arcName
    ? `${arcName}.arc`
    : address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  return { arcName, displayName, isLoading }
}