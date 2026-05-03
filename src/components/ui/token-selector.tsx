"use client";
import { Fragment } from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "./utils";
import { SUPPORTED_TOKENS } from "@/lib/blockchain/tokens";
import type { TokenSymbol } from "@/types";
import { TokenLogo } from "./token-logo";

interface TokenSelectorProps {
  value: TokenSymbol;
  onChange: (value: TokenSymbol) => void;
  className?: string;
}

export function TokenSelector({ value, onChange, className }: TokenSelectorProps) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as TokenSymbol)}>
      <Select.Trigger
        className={cn(
          "flex h-10 min-w-[110px] items-center gap-2 rounded-xl border border-surface-400 bg-surface-200 px-3 text-sm text-gray-100",
          "hover:border-surface-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-colors",
          className
        )}
      >
        <TokenLogo symbol={value} size={18} />
        <Select.Value />
        <Select.Icon className="ml-auto text-gray-500">
          <ChevronDown className="h-4 w-4" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="z-50 min-w-[140px] overflow-hidden rounded-xl border border-surface-400 bg-surface-100 shadow-xl animate-slide-up"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-1">
            {SUPPORTED_TOKENS.map((token) => (
              <Select.Item
                key={token.symbol}
                value={token.symbol}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none hover:bg-surface-300 data-[highlighted]:bg-surface-300 transition-colors"
              >
                <TokenLogo symbol={token.symbol as TokenSymbol} size={18} />
                <Select.ItemText>{token.symbol}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check className="h-3.5 w-3.5 text-brand-400" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
