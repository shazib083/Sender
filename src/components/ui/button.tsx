"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gradient";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-brand-600 hover:bg-brand-500 text-white shadow-glow-sm hover:shadow-glow active:scale-95":
              variant === "primary",
            "bg-surface-300 hover:bg-surface-400 text-white border border-surface-400 hover:border-surface-500":
              variant === "secondary",
            "hover:bg-surface-200 text-gray-300 hover:text-white": variant === "ghost",
            "bg-red-600 hover:bg-red-500 text-white": variant === "danger",
            "bg-gradient-to-r from-brand-600 via-purple-600 to-pink-600 hover:opacity-90 text-white shadow-glow active:scale-95":
              variant === "gradient",
          },
          {
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
