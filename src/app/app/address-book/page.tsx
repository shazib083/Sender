"use client";
import { useState } from "react";
import { useAddressBookStore } from "@/lib/store/batch-store";
import { useBatchStore } from "@/lib/store/batch-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { truncateAddress, isValidEthAddress } from "@/lib/utils/validation";
import { BookUser, Plus, Trash2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AddressBookPage() {
  const { entries, addEntry, removeEntry } = useAddressBookStore();
  const { importRows } = useBatchStore();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");

  const handleAdd = () => {
    if (!label.trim()) { toast.error("Label is required"); return; }
    if (!isValidEthAddress(address)) { toast.error("Invalid wallet address"); return; }
    addEntry(label.trim(), address.trim());
    setLabel("");
    setAddress("");
    toast.success("Address saved");
  };

  const handleUseInBatch = (addr: string) => {
    importRows([{ address: addr, amount: "", tokenSymbol: "USDC" }]);
    router.push("/app");
    toast.success("Address added to batch");
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <BookUser className="h-6 w-6 text-brand-400" />
          Address Book
        </h1>
        <p className="text-sm text-gray-500 mt-1">Save frequently-used wallet addresses for quick access.</p>
      </div>

      {/* Add new entry */}
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Add New Address</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Team Wallet)"
          />
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder="0xWalletAddress"
            error={address.length > 0 && !isValidEthAddress(address)}
            className="font-mono text-xs"
          />
          <Button variant="primary" onClick={handleAdd}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {/* List */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 py-16 text-center">
          <BookUser className="mx-auto h-10 w-10 text-gray-600 mb-3" />
          <p className="text-gray-500 text-sm">No saved addresses yet</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          <div className="divide-y divide-surface-300">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-surface-200/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{entry.label}</p>
                  <p className="font-mono text-xs text-gray-500">{truncateAddress(entry.address, 8)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUseInBatch(entry.address)}
                    className="text-brand-400 hover:text-brand-300 text-xs"
                  >
                    Use in batch <ArrowRight className="h-3 w-3" />
                  </Button>
                  <button
                    onClick={() => { removeEntry(entry.id); toast.success("Removed"); }}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
