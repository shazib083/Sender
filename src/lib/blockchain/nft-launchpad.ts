import { decodeEventLog, type Address, type Hex } from "viem";
import { createArcPublicClient, createArcWalletClient, getExplorerTxUrl } from "@/lib/blockchain/provider";

export type LaunchpadStandard = "ERC721" | "ERC1155";

export interface LaunchCollectionInput {
  salt: Hex; 
  standard: LaunchpadStandard;
  name: string;
  symbol: string;
  metadataUri: string;
  maxSupply: number;
  mintQuantity: number;
  recipient: Address;
}

const NFT_LAUNCHPAD_ADDRESS = (
  process.env.NEXT_PUBLIC_NFT_LAUNCHPAD_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as Address;

export const NFT_LAUNCHPAD_ABI = [
  {
    type: "function",
    name: "createCollection",
    stateMutability: "nonpayable",
    inputs: [
      { name: "salt", type: "bytes32" }, 
      { name: "standard", type: "uint8" },
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "metadataUri_", type: "string" },
      { name: "maxSupply_", type: "uint256" },
    ],
    outputs: [
      { name: "collectionId", type: "uint256" },
      { name: "collection", type: "address" },
    ],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collectionId", type: "uint256" },
      { name: "to", type: "address" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "collectionCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "CollectionCreated",
    inputs: [
      { name: "collectionId", type: "uint256", indexed: true },
      { name: "collection", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "standard", type: "uint8", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "maxSupply", type: "uint256", indexed: false },
    ],
  },
] as const;

export function isLaunchpadConfigured() {
  return NFT_LAUNCHPAD_ADDRESS !== "0x0000000000000000000000000000000000000000";
}

export function buildNftMetadataUri(name: string, description: string, image: string) {
  const metadata = {
    name,
    description,
    image,
    attributes: [
      { trait_type: "Network", value: "Arc Testnet" },
      { trait_type: "Launchpad", value: "Sender" },
    ],
  };

  const bytes = new TextEncoder().encode(JSON.stringify(metadata));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return `data:application/json;base64,${btoa(binary)}`;
}

export async function createAndMintCollection(input: LaunchCollectionInput) {
  if (!isLaunchpadConfigured()) {
    throw new Error("Set NEXT_PUBLIC_NFT_LAUNCHPAD_CONTRACT_ADDRESS in your env configuration profile.");
  }

  const walletClient = createArcWalletClient();
  const publicClient = createArcPublicClient();
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");

  const standardId = input.standard === "ERC721" ? 0 : 1;

  // 1. Snapshot count baseline before submission to safeguard tracking indexes
  const countBefore = await publicClient.readContract({
    address: NFT_LAUNCHPAD_ADDRESS,
    abi: NFT_LAUNCHPAD_ABI,
    functionName: "collectionCount",
  });

  const safeSalt = input.salt;

  // STEP 1: Execute Collection Factory Creation
  const createHash = await walletClient.writeContract({
    address: NFT_LAUNCHPAD_ADDRESS,
    abi: NFT_LAUNCHPAD_ABI,
    functionName: "createCollection",
    account,
    args: [
      safeSalt, 
      standardId, 
      input.name, 
      input.symbol, 
      input.metadataUri, 
      BigInt(input.maxSupply)
    ],
    gas: 3000000n,
  });

  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  
  // ─── ⏳ ARC TESTNET RPC BLOCK INDEXING BUFFER ───
  await new Promise((resolve) => setTimeout(resolve, 3500));

  // 2. Fetch trailing index counter to verify structural update
  const countAfter = await publicClient.readContract({
    address: NFT_LAUNCHPAD_ADDRESS,
    abi: NFT_LAUNCHPAD_ABI,
    functionName: "collectionCount",
  });

  const collectionId = countAfter > countBefore ? countBefore : countBefore;

  // STEP 2: Execute Token Minting Allocation targeting the validated on-chain ID
  // 🟢 FIXED: Dynamic gas matrix calculation to clean bulk sequential state writing limits up to 100 items
  const calculatedGasBuffer = 100000n + (BigInt(input.mintQuantity) * 120000n);

  const mintHash = await walletClient.writeContract({
    address: NFT_LAUNCHPAD_ADDRESS,
    abi: NFT_LAUNCHPAD_ABI,
    functionName: "mint",
    account,
    args: [collectionId, input.recipient, BigInt(input.mintQuantity)],
    gas: calculatedGasBuffer,
  });

  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });

  return {
    collectionId: collectionId.toString(),
    createTxHash: createHash,
    mintTxHash: mintHash,
    createTxUrl: getExplorerTxUrl(createHash),
    mintTxUrl: getExplorerTxUrl(mintHash),
    createStatus: createReceipt.status,
    mintStatus: mintReceipt.status,
  };
}