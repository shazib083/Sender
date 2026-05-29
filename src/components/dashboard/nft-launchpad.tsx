"use client";

import { useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ImagePlus, Rocket, Sparkles, ExternalLink, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { type Hex } from "viem";
import {
  buildNftMetadataUri,
  createAndMintCollection,
  isLaunchpadConfigured,
  type LaunchpadStandard,
} from "@/lib/blockchain/nft-launchpad";

const MAX_COLLECTION_SIZE = 100;
const MAX_IMAGE_BYTES = 160 * 1024;

interface LaunchResult {
  collectionId: string;
  createTxUrl: string;
  mintTxUrl: string;
}

export function NftLaunchpad() {
  const { address, isConnected } = useAccount();
  const fileRef = useRef<HTMLInputElement>(null);
  const [standard, setStandard] = useState<LaunchpadStandard>("ERC721");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [maxSupply, setMaxSupply] = useState(100);
  const [mintQuantity, setMintQuantity] = useState(1);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);

  const remaining = useMemo(
    () => Math.max(0, Math.min(MAX_COLLECTION_SIZE, maxSupply || 0) - (mintQuantity || 0)),
    [maxSupply, mintQuantity]
  );

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large. Use an optimized image under 160 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result ?? ""));
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleLaunch = async () => {
    if (!isConnected || !address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!isLaunchpadConfigured()) {
      toast.error("Deploy the launchpad contract and set NEXT_PUBLIC_NFT_LAUNCHPAD_CONTRACT_ADDRESS");
      return;
    }
    if (!name.trim() || !symbol.trim() || !imageDataUrl) {
      toast.error("Add a name, ticker, and artwork");
      return;
    }
    if (maxSupply < 1 || maxSupply > MAX_COLLECTION_SIZE) {
      toast.error("Collection size must be between 1 and 100");
      return;
    }
    if (mintQuantity < 1 || mintQuantity > maxSupply) {
      toast.error("Mint amount must fit inside the collection size");
      return;
    }

    setIsLaunching(true);
    setResult(null);

    try {
      const leanMetadataUri = buildNftMetadataUri(
        name.trim(),
        description.trim() || `${name.trim()} on Arc Testnet`,
        "https://ipfs.io/ipfs/QmZTM7v886bC39wQ5V7aP4LwU8R4R6pXfH8Y8mN5v8B3Cj"
      );

      // Generates an exact 32-byte safe hex salt matching user modifier rules
      const saltBytes = new Uint8Array(32);
      const cleanAddress = address.startsWith("0x") ? address.slice(2) : address;
      for (let i = 0; i < 20; i++) {
        saltBytes[i] = parseInt(cleanAddress.substr(i * 2, 2), 16);
      }
      const randomEntropy = window.crypto.getRandomValues(new Uint8Array(12));
      for (let i = 0; i < 12; i++) {
        saltBytes[20 + i] = randomEntropy[i];
      }
      const safeSalt = `0x${Array.from(saltBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}` as Hex;

      // Execute with the optimized layout properties
      const launchResult = await createAndMintCollection({
        salt: safeSalt, 
        standard,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        metadataUri: leanMetadataUri, 
        maxSupply,
        mintQuantity,
        recipient: address,
      });

      setResult(launchResult);
      toast.success("NFT collection launched and minted successfully!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "NFT launch failed";
      toast.error(message);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <section className="rounded-2xl border border-surface-300 bg-surface-100">
      <div className="flex flex-col gap-4 border-b border-surface-300 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">NFT Launchpad</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">ERC-721 or ERC-1155 collections capped at 100 NFTs</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-surface-300 bg-surface-200 p-1">
          {(["ERC721", "ERC1155"] as LaunchpadStandard[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStandard(item)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                standard === item
                  ? "bg-brand-600 text-white shadow-glow-sm"
                  : "text-gray-400 hover:bg-surface-300 hover:text-white"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[220px_1fr]">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImageUpload(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed",
              "border-surface-400 bg-surface-200 text-gray-500 transition-colors hover:border-brand-500 hover:text-white"
            )}
          >
            {imageDataUrl ? (
              <img src={imageDataUrl} alt={imageName || "NFT artwork"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm font-medium">Upload art</span>
              </div>
            )}
          </button>
          {imageName && <p className="mt-2 truncate text-xs text-gray-500">{imageName}</p>}
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 text-white">Collection Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Arc Pass" className="text-white placeholder-gray-600" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 text-white">Ticker</span>
              <Input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.slice(0, 12))}
                placeholder="ARC"
                className="text-white placeholder-gray-600"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 text-white">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A short note for this collection"
              className={cn(
                "min-h-[86px] w-full resize-none rounded-xl border border-surface-400 bg-surface-200 px-3 py-2",
                "text-sm text-white placeholder-gray-600 transition-colors hover:border-surface-500",
                "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              )}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 text-white">Collection Size</span>
              <Input
                type="number"
                min={1}
                max={MAX_COLLECTION_SIZE}
                value={maxSupply}
                onChange={(event) => setMaxSupply(Number(event.target.value))}
                className="text-white"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 text-white">Mint Now</span>
              <Input
                type="number"
                min={1}
                max={maxSupply}
                value={mintQuantity}
                onChange={(event) => setMintQuantity(Number(event.target.value))}
                className="text-white"
              />
            </label>
            <div className="rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 text-white">Remaining</p>
              <p className="mt-1 text-2xl font-bold text-white tabular-nums">{remaining}</p>
            </div>
          </div>

          {result && (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Collection #{result.collectionId} launched successfully!
              </div>
              <div className="flex gap-2">
                <a href={result.createTxUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Create tx
                  </Button>
                </a>
                <a href={result.mintTxUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Mint tx
                  </Button>
                </a>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={handleLaunch}
            loading={isLaunching}
            disabled={!isConnected || isLaunching}
            className="w-full sm:w-auto"
          >
            <Rocket className="h-4 w-4" />
            {isLaunching ? "Launching..." : "Launch & Mint"}
          </Button>
        </div>
      </div>
    </section>
  );
}