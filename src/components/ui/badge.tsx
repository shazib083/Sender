"use client";
import { cn } from "./utils";
import type { RowStatus } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "error" | "warning" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-surface-300 text-gray-300": variant === "default",
          "bg-emerald-500/20 text-emerald-400": variant === "success",
          "bg-red-500/20 text-red-400": variant === "error",
          "bg-amber-500/20 text-amber-400": variant === "warning",
          "bg-brand-500/20 text-brand-300": variant === "info",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_CONFIG: Record<
  RowStatus,
  { label: string; variant: BadgeProps["variant"]; dot: string }
> = {
  idle: { label: "Ready", variant: "default", dot: "bg-gray-500" },
  validating: { label: "Validating", variant: "info", dot: "bg-brand-400 animate-pulse" },
  valid: { label: "Valid", variant: "success", dot: "bg-emerald-400" },
  invalid: { label: "Invalid", variant: "error", dot: "bg-red-400" },
  pending: { label: "Pending", variant: "warning", dot: "bg-amber-400 animate-pulse" },
  success: { label: "Sent", variant: "success", dot: "bg-emerald-400" },
  failed: { label: "Failed", variant: "error", dot: "bg-red-400" },
};

export function StatusBadge({ status }: { status: RowStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant}>
      <span className={cn("mr-1 h-1.5 w-1.5 rounded-full inline-block", config.dot)} />
      {config.label}
    </Badge>
  );
}
