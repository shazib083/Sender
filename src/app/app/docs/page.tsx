import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Zap,
  Shield,
  Globe,
  Code2,
  FileText,
  Image,
} from "lucide-react";

export default function DocsPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">

      {/* ── Page header ── */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <BookOpen className="h-6 w-6 text-brand-400" />
          Sender MultiSend — Documentation
        </h1>
        <p className="mt-2 text-gray-400">
          How to use Sender MultiSend on Arc Testnet — batch-distribute USDC, EURC,
          cirBTC, and NFTs to hundreds of wallets in a single transaction.
        </p>
      </div>

      {/* ── Overview ── */}
      <DocSection title="Overview" icon={<Globe className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-4">
          Sender MultiSend is a gas-optimised batch token and NFT distribution dApp built on Arc Testnet.
          It supports Circle USDC &amp; EURC (ERC-20), cirBTC, ERC-721, and ERC-1155 NFTs.
          A flat protocol fee of <strong className="text-white">0.001 USDC per recipient</strong> applies.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Zap className="h-4 w-4" />, title: "Batch Transfers", desc: "Send to 200 recipients in one transaction" },
            { icon: <Shield className="h-4 w-4" />, title: "Pre-flight Checks", desc: "Balance & address validation before execution" },
            { icon: <Image className="h-4 w-4" />, title: "NFT Support", desc: "ERC-721 and ERC-1155 bulk send" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-surface-300 bg-surface-200 p-3">
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
                {f.icon}
              </div>
              <p className="text-xs font-semibold text-white">{f.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </DocSection>

      {/* ── Connect to Arc Testnet (user-facing wallet setup) ── */}
      <DocSection title="1. Connect to Arc Testnet" icon={<Globe className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-3">
          Sender runs on Arc Testnet — an EVM-compatible chain. Connecting your wallet
          on the dashboard will prompt you to add or switch to Arc automatically. To add
          it manually in MetaMask, use these values:
        </p>
        <div className="overflow-x-auto rounded-xl border border-surface-400">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-surface-400">
              {[
                ["Network Name", "Arc Testnet"],
                ["RPC URL", "https://rpc.testnet.arc.network"],
                ["Chain ID", "5042002"],
                ["Currency Symbol", "USDC"],
                ["Block Explorer", "https://testnet.arcscan.app"],
              ].map(([k, v]) => (
                <tr key={k} className="hover:bg-surface-200/50">
                  <td className="px-4 py-2 font-medium text-gray-400 whitespace-nowrap">{k}</td>
                  <td className="px-4 py-2 font-mono text-gray-300">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>

      {/* ── NFT Holdings ── */}
      <DocSection title="2. NFT Holdings Feature" icon={<Image className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-3">
          The NFT tab shows all ERC-721 and ERC-1155 tokens held by the connected wallet.
          Data is fetched from the Blockscout API:
        </p>
        <CodeBlock>{`GET https://testnet.arcscan.app/api/v2/addresses/{address}/nft/collections
  ?type=ERC-721,ERC-1155`}</CodeBlock>
        <p className="text-sm text-gray-400 mt-4 mb-2">Features:</p>
        <ul className="space-y-1.5 text-sm text-gray-400">
          {[
            "Shows NFT name, symbol, and ERC standard badge",
            "Copy contract address to clipboard with one click",
            "Lists all owned token IDs (expandable for large collections)",
            "Auto-refreshes every 60 seconds",
            "Supports pagination for wallets with many NFTs",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </DocSection>

      {/* ── CSV Format ── */}
      <DocSection title="3. CSV Format" icon={<FileText className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-3">
          Upload or paste CSV in this format for token transfers:
        </p>
        <CodeBlock>{`wallet_address,amount,token
0x1234...abcd,10.50,USDC
0xabcd...1234,5.00,EURC
0x9876...dcba,1.00,USDC`}</CodeBlock>
        <p className="text-sm text-gray-400 mt-4 mb-3">
          For NFT bulk send:
        </p>
        <CodeBlock>{`contract_address,token_id,amount,standard,recipient_address
0xNFTContract,1,1,ERC721,0xRecipient1
0xNFTContract,42,5,ERC1155,0xRecipient2`}</CodeBlock>
        <ul className="mt-3 space-y-1 text-sm text-gray-400">
          {[
            "Header row is optional — auto-detected",
            "Token defaults to USDC if not specified",
            "Max 200 rows per batch",
            "Download the Excel template from the Dashboard for a pre-formatted file",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </DocSection>

      {/* ── Security Checklist ── */}
      <DocSection title="4. Security Checklist" icon={<Shield className="h-4 w-4 text-brand-400" />}>
        <ul className="space-y-2">
          {SECURITY_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </DocSection>

      {/* ── Architecture ── */}
      <DocSection title="5. Project Architecture" icon={<Code2 className="h-4 w-4 text-brand-400" />}>
        <pre className="overflow-x-auto rounded-xl border border-surface-400 bg-surface-200 p-4 text-xs text-gray-300 leading-relaxed">
{`src/
├── app/
│   └── app/
│       ├── page.tsx             # Dashboard (Token + NFT tabs)
│       ├── history/page.tsx     # Transaction history (live from Blockscout)
│       └── docs/page.tsx        # This page
│
├── components/dashboard/        # Recipients table, summary panels, NFT holdings
│
├── lib/
│   ├── blockchain/
│   │   ├── provider.ts          # Arc Testnet viem client
│   │   ├── tokens.ts            # Token registry + formatters
│   │   ├── multisend.ts         # Token batch execution (pull-then-push)
│   │   ├── nft.ts               # NFT batch execution
│   │   └── history.ts           # Blockscout history reader
│   ├── hooks/                   # use-batch-execution, use-nft-execution, ...
│   └── store/                   # Zustand state (in-memory)
│
└── types/                       # Domain TypeScript types`}
        </pre>
      </DocSection>

      {/* ── Support ── */}
      <DocSection title="Support & Resources" icon={<ExternalLink className="h-4 w-4 text-brand-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RESOURCES.map((r) => (
            <a
              key={r.label}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-200 p-3 hover:border-brand-500/40 hover:bg-surface-300 transition-all group"
            >
              <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-brand-400 transition-colors" />
              <div>
                <p className="text-sm font-medium text-white">{r.label}</p>
                <p className="text-xs text-gray-500">{r.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </DocSection>

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function DocSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-surface-400 bg-surface-200 p-4 text-xs text-gray-300 leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

const SECURITY_ITEMS = [
  "All wallet addresses validated with isAddress() from viem",
  "Amounts sanitized — only digits and single decimal point allowed",
  "CSV paste input sanitized against XSS (strips HTML tags, JS URIs, event handlers)",
  "Max batch size: 200 recipients — enforced in UI and smart contract",
  "Balance check before execution — insufficient tokens flagged pre-flight",
  "Smart contract uses custom errors for cheaper gas than require strings",
  "Ownership secured with OpenZeppelin Ownable (owner-only fee & withdrawals)",
  "Transaction history read live from Blockscout — nothing stored in the browser",
];

const RESOURCES = [
  { label: "Arc Network Docs", desc: "docs.arc.network", url: "https://docs.arc.network" },
  { label: "Circle Developer Portal", desc: "developers.circle.com", url: "https://developers.circle.com" },
  { label: "Arc Block Explorer", desc: "testnet.arcscan.app", url: "https://testnet.arcscan.app" },
  { label: "WalletConnect Docs", desc: "docs.walletconnect.com", url: "https://docs.walletconnect.com" },
  { label: "Circle Testnet Faucet", desc: "Get testnet USDC/EURC", url: "https://faucet.circle.com" },
];
