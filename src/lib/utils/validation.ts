// ============================================================
// lib/utils/validation.ts
// Address and input validation
// ============================================================

import { isAddress, getAddress } from "viem";

export function isValidEthAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  try {
    return isAddress(address);
  } catch {
    return false;
  }
}

export function checksumAddress(address: string): string {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
}

export function isValidAmount(value: string): boolean {
  if (!value || value.trim() === "") return false;
  const sanitized = value.replace(/[^0-9.]/g, "");
  const num = parseFloat(sanitized);
  return !isNaN(num) && num > 0 && isFinite(num) && /^\d+(\.\d+)?$/.test(sanitized);
}

export function sanitizeAmountInput(value: string): string {
  // Only allow digits and a single decimal point
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) return parts[0] + "." + parts.slice(1).join("");
  return cleaned;
}

export function clampAmountDecimals(value: string, decimals: number): string {
  const parts = value.split(".");
  if (parts.length === 2 && parts[1].length > decimals) {
    return parts[0] + "." + parts[1].slice(0, decimals);
  }
  return value;
}

export function validateBatchSize(count: number, max = 200): string | null {
  if (count === 0) return "Add at least one recipient";
  if (count > max) return `Maximum batch size is ${max} recipients`;
  return null;
}

// Prevent XSS in pasted CSV
export function sanitizeCsvInput(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/javascript:/gi, "") // strip js: URIs
    .replace(/on\w+=/gi, "") // strip event handlers
    .slice(0, 500_000); // hard length cap
}
