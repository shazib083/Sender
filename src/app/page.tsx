"use client";
import Link from "next/link";
import { ArrowRight, Zap, Shield, BarChart3, Globe, ChevronRight } from "lucide-react";
import { useBatchStore } from "@/lib/store/batch-store";
import { useEffect } from "react";

export default function LandingPage() {
  const { theme } = useBatchStore();

  // Keep <html> class in sync on landing page too
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(theme);
  }, [theme]);

  return (
    <main className="min-h-screen overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-surface-300 bg-surface/70 backdrop-blur-xl transition-colors duration-300">
        <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5 font-bold text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 shadow-glow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="gradient-text">Sender</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features"    className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="https://docs.arc.network" target="_blank" rel="noopener" className="hover:text-white transition-colors">Docs</a>
          </div>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-all hover:shadow-glow-sm active:scale-95"
          >
            Launch App <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center pt-16">
        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(100,112,241,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(100,112,241,0.15) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glow orbs */}
        <div className="pointer-events-none absolute left-1/4 top-1/3 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 h-64 w-64 rounded-full bg-purple-600/15 blur-3xl" />

        {/* Light-mode mint orb */}
        <div className="pointer-events-none absolute left-1/2 bottom-1/4 h-56 w-56 -translate-x-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-500 [html.light_&]:opacity-100"
          style={{ background: "radial-gradient(circle, #baeae0 0%, transparent 70%)" }}
        />

        <div className="relative max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            Live on Arc Testnet · Circle USDC &amp; EURC
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl text-gray-100">
            Send Tokens &amp; NFTs to{" "}
            <span className="gradient-text-brand">hundreds of wallets</span>{" "}
            in one click
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400 leading-relaxed">
            Sender is the fastest way to batch-distribute native tokens and NFTs on Rialo & Arc.
            Upload a CSV, review and execute with a single transaction.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 via-purple-600 to-pink-600 px-8 py-4 text-base font-semibold text-white shadow-glow hover:opacity-90 transition-all active:scale-95"
            >
              Launch App
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://docs.arc.network"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-xl border border-surface-400 bg-surface-200 px-8 py-4 text-base font-medium text-gray-300 hover:border-surface-500 hover:text-white transition-all"
            >
              Read the docs <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-6 rounded-2xl border border-surface-300 bg-surface-100/50 p-6 backdrop-blur-sm">
            {[
              { value: "200",     label: "Recipients per batch" },
              { value: "2",       label: "Supported tokens"     },
              { value: "1-click", label: "Batch execution"      },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold gradient-text-brand">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl text-gray-100">
              Everything you need to{" "}
              <span className="gradient-text-brand">distribute at scale</span>
            </h2>
            <p className="mt-4 text-gray-400 max-w-xl mx-auto">
              Built for teams, DAOs, and protocols that need reliable, gas-efficient token distribution.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="mx-auto max-w-screen-lg">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl text-gray-100">
              How it works
            </h2>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-8 bottom-8 w-px bg-gradient-to-b from-brand-500 via-purple-500 to-transparent hidden md:block" />
            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <StepCard key={step.title} step={i + 1} {...step} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="rounded-3xl border border-surface-300 bg-surface-100 p-12 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-mesh-gradient" />
            {/* Light mode mint overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 [html.light_&]:opacity-100"
              style={{ background: "linear-gradient(135deg, rgba(186,234,224,0.3) 0%, transparent 60%)" }}
            />
            <h2 className="relative text-3xl font-bold text-gray-100 mb-4">
              Ready to send at scale?
            </h2>
            <p className="relative text-gray-400 mb-8">
              Connect your wallet and start distributing tokens in minutes.
            </p>
            <Link
              href="/app"
              className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 via-purple-600 to-pink-600 px-8 py-4 text-base font-semibold text-white shadow-glow hover:opacity-90 transition-all active:scale-95"
            >
              Launch App <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-surface-300 py-8 px-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Sender MultiSend. All rights reserved. Built on Arc Testnet with Circle.
      </footer>
    </main>
  );
}

// ---- Data ----
const FEATURES = [
  {
    icon: Zap,
    title: "Gas-optimized batching",
    description: "MultiSend smart contract groups all transfers into one transaction, saving up to 60% gas vs sequential sends.",
  },
  {
    icon: Globe,
    title: "Multi-token support",
    description: "Send USDC, EURC, and native ARC tokens simultaneously in the same batch — mix and match freely.",
  },
  {
    icon: Shield,
    title: "Pre-flight validation",
    description: "Every address and amount is validated before execution. Insufficient balances are flagged before any gas is spent.",
  },
  {
    icon: BarChart3,
    title: "CSV upload & paste",
    description: "Import hundreds of recipients via CSV upload, paste, or download our Excel template. Bulk operations made simple.",
  },
  {
    icon: ArrowRight,
    title: "Transaction history",
    description: "Full audit trail of every batch. Export reports to Excel for accounting and compliance purposes.",
  },
  {
    icon: Globe,
    title: "Address book",
    description: "Save frequently-used wallet addresses with labels. Quickly recall them when building your next batch.",
  },
];

const STEPS = [
  {
    title: "Connect your wallet",
    description: "Use MetaMask or WalletConnect to connect to Arc Testnet. The app auto-detects the correct network.",
  },
  {
    title: "Add recipients",
    description: "Manually enter wallet addresses and amounts, or upload a CSV/Excel file to bulk-import hundreds of rows.",
  },
  {
    title: "Review the summary",
    description: "The summary panel shows per-token totals, estimated gas, and warns you of any balance shortfalls.",
  },
  {
    title: "Execute the batch",
    description: "Approve token spending once, then confirm the batch transaction. All recipients receive funds in one block.",
  },
];

// ---- Sub-components ----
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-surface-300 bg-surface-100 p-6 hover:border-brand-500/40 hover:shadow-glow-sm transition-all">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 group-hover:bg-brand-500/20 transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 font-semibold text-gray-100">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex gap-6 rounded-2xl border border-surface-300 bg-surface-100 p-6 md:ml-16">
      <div className="absolute -left-8 top-6 hidden md:flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-brand-500 bg-surface text-xs font-bold text-brand-400">
        {step}
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-500/30 bg-brand-500/10 text-xs font-bold text-brand-400 md:hidden">
        {step}
      </div>
      <div>
        <h3 className="font-semibold text-gray-100 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}