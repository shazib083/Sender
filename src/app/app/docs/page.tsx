import {
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Zap,
  Shield,
  Globe,
  Code2,
  Wallet,
  FileText,
  Terminal,
  Package,
  GitBranch,
  RefreshCw,
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
          Complete guide to setting up, deploying, and using Sender MultiSend on Arc Testnet.
          Batch-distribute USDC, EURC, and NFTs to hundreds of wallets in a single transaction.
        </p>
      </div>

      {/* ── Overview ── */}
      <DocSection title="Overview" icon={<Globe className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-4">
          Sender MultiSend is a gas-optimised batch token and NFT distribution dApp built on Arc Testnet.
          It supports Circle USDC &amp; EURC (ERC-20), ERC-721, and ERC-1155 NFTs.
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

      {/* ── Quick Start ── */}
      <DocSection title="1. Quick Start" icon={<Terminal className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-3">Clone the repo and install dependencies:</p>
        <CodeBlock>{`git clone https://github.com/your-org/sender-multisend.git
cd sender-multisend
npm install --legacy-peer-deps`}</CodeBlock>
        <p className="text-sm text-gray-400 mt-4 mb-3">Copy the environment file and fill in your values:</p>
        <CodeBlock>{`cp .env.example .env.local`}</CodeBlock>
        <p className="text-sm text-gray-400 mt-4 mb-3">Run the development server:</p>
        <CodeBlock>{`npm run dev
# Open http://localhost:3000`}</CodeBlock>
      </DocSection>

      {/* ── Environment Variables ── */}
      <DocSection title="2. Environment Setup" icon={<FileText className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-4">
          Copy <code className="code">.env.example</code> to <code className="code">.env.local</code> and fill in:
        </p>
        <EnvTable vars={ENV_VARS} />
        <InfoBox type="warning" className="mt-4">
          Never expose <code>CIRCLE_API_KEY</code>, <code>CIRCLE_ENTITY_SECRET</code>, or{" "}
          <code>CIRCLE_WALLET_SET_ID</code> to the browser. These are server-side only.
        </InfoBox>
      </DocSection>

      {/* ── Arc Testnet ── */}
      <DocSection title="3. Arc Testnet Configuration" icon={<Globe className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-3">
          Sender runs on Arc Testnet — an EVM-compatible chain. Confirm the correct values from{" "}
          <a href="https://docs.arc.network" target="_blank" rel="noopener" className="text-brand-400 hover:underline">
            docs.arc.network
          </a>.
        </p>
        <CodeBlock>{`NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID=5042002`}</CodeBlock>
        <InfoBox type="warning" className="mt-3">
          Verify the chain ID from the official Arc docs before deploying to production.
        </InfoBox>
        <p className="text-sm text-gray-400 mt-4 mb-2">Add Arc Testnet to MetaMask manually:</p>
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

      {/* ── Circle SDK ── */}
      <DocSection title="4. Circle SDK Setup" icon={<Package className="h-4 w-4 text-brand-400" />}>
        <ol className="space-y-3 text-sm text-gray-400 list-none">
          {CIRCLE_STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-400">
                {i + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: step }} />
            </li>
          ))}
        </ol>
        <InfoBox type="info" className="mt-4">
          The Circle adapter at <code>src/lib/blockchain/circle-adapter.ts</code> uses raw fetch calls.
          Replace with the official SDK once configured.
        </InfoBox>
        <p className="text-sm text-gray-400 mt-4 mb-2">Upgrade to official SDK:</p>
        <CodeBlock>{`npm install @circle-fin/developer-controlled-wallets`}</CodeBlock>
      </DocSection>

      {/* ── MultiSend Contract ── */}
      <DocSection title="5. MultiSend Contract Deployment" icon={<Code2 className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-3">
          Deploy <code className="code">contracts/MultiSend.sol</code> to Arc Testnet.
          The contract supports <strong className="text-white">ERC-20</strong>,{" "}
          <strong className="text-white">ERC-721</strong>, and{" "}
          <strong className="text-white">ERC-1155</strong> batch transfers.
          Max batch size: <strong className="text-white">200 recipients</strong>.
        </p>
        <CodeBlock>{`# Install Hardhat deps
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv

# Deploy to Arc Testnet
npx hardhat run scripts/deploy.ts --network arc-testnet`}</CodeBlock>
        <p className="text-sm text-gray-400 mt-3 mb-2">
          After deployment, set the contract address in your <code className="code">.env.local</code>:
        </p>
        <CodeBlock>{`NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS=0xYourDeployedAddress`}</CodeBlock>
        <InfoBox type="info" className="mt-3">
          If this variable is not set, the app falls back to sequential ERC-20 transfers automatically.
        </InfoBox>
      </DocSection>

      {/* ── Token Addresses ── */}
      <DocSection title="6. Token Contract Addresses" icon={<Wallet className="h-4 w-4 text-brand-400" />}>
        <p className="text-sm text-gray-400 mb-3">
          Set the USDC and EURC contract addresses for Arc Testnet:
        </p>
        <CodeBlock>{`NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_EURC_CONTRACT_ADDRESS=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`}</CodeBlock>
        <InfoBox type="info" className="mt-3">
          USDC is the native gas token on Arc Testnet (<code>isNative: true</code>).
          EURC is a standard ERC-20. Both use 6 decimals.
        </InfoBox>
      </DocSection>

      {/* ── NFT Holdings ── */}
      <DocSection title="7. NFT Holdings Feature" icon={<Image className="h-4 w-4 text-brand-400" />}>
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
      <DocSection title="8. CSV Format" icon={<FileText className="h-4 w-4 text-brand-400" />}>
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

      {/* ── Vercel Deployment ── */}
      <DocSection title="9. Deployment to Vercel" icon={<GitBranch className="h-4 w-4 text-brand-400" />}>
        <CodeBlock>{`# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Add server-side env vars
vercel env add CIRCLE_API_KEY production
vercel env add CIRCLE_WALLET_SET_ID production
vercel env add CIRCLE_ENTITY_SECRET production`}</CodeBlock>
        <InfoBox type="warning" className="mt-3">
          Add all <code>NEXT_PUBLIC_</code> variables in the Vercel dashboard under
          Project → Settings → Environment Variables.
        </InfoBox>
      </DocSection>

      {/* ── Security Checklist ── */}
      <DocSection title="10. Security Checklist" icon={<Shield className="h-4 w-4 text-brand-400" />}>
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
      <DocSection title="11. Project Architecture" icon={<Code2 className="h-4 w-4 text-brand-400" />}>
        <pre className="overflow-x-auto rounded-xl border border-surface-400 bg-surface-200 p-4 text-xs text-gray-300 leading-relaxed">
{`src/
├── app/
│   ├── layout.tsx               # Root layout + Providers
│   ├── page.tsx                 # Landing page
│   └── app/
│       ├── layout.tsx           # Dashboard shell + AppHeader
│       ├── page.tsx             # Dashboard (Token + NFT tabs)
│       ├── history/page.tsx     # Transaction history
│       ├── address-book/        # Saved addresses
│       └── docs/page.tsx        # This page
│
├── components/
│   ├── ui/                      # Button, Input, Badge, TokenLogo
│   ├── layout/                  # AppHeader, WalletConnectButton
│   └── dashboard/
│       ├── token-balance-cards  # USDC/EURC balances
│       ├── recipients-table     # Batch recipient input
│       ├── summary-panel        # Totals + Execute button
│       └── wallet-nft-holdings  # NFT holdings panel
│
├── lib/
│   ├── blockchain/
│   │   ├── provider.ts          # Arc Testnet viem client
│   │   ├── tokens.ts            # Token registry + formatters
│   │   ├── multisend.ts         # Batch execution logic
│   │   └── circle-adapter.ts   # Circle API adapter
│   ├── hooks/
│   │   ├── use-token-balances   # On-chain token balances
│   │   ├── use-batch-execution  # Validate + execute batch
│   │   └── use-wallet-nfts      # NFT holdings via Blockscout
│   ├── store/
│   │   └── batch-store.ts       # Zustand state
│   └── utils/
│       ├── csv.ts               # CSV/XLSX parse + export
│       └── validation.ts        # Address + amount validators
│
└── types/index.ts               # Domain TypeScript types`}
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

// ── Sub-components ────────────────────────────────────────────

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

function EnvTable({
  vars,
}: {
  vars: { key: string; description: string; required: boolean }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-400">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-400 bg-surface-200">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variable</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-400">
          {vars.map((v) => (
            <tr key={v.key} className="hover:bg-surface-200/50">
              <td className="px-4 py-2.5 font-mono text-xs text-brand-300 whitespace-nowrap">{v.key}</td>
              <td className="px-4 py-2.5 text-xs text-gray-400">{v.description}</td>
              <td className="px-4 py-2.5">
                {v.required
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : <span className="text-xs text-gray-600">Optional</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoBox({
  type,
  children,
  className = "",
}: {
  type: "warning" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const styles =
    type === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-brand-500/30 bg-brand-500/10 text-brand-300";
  return (
    <div className={`flex gap-2 rounded-xl border p-3.5 text-sm ${styles} ${className}`}>
      {type === "warning"
        ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        : <BookOpen className="h-4 w-4 shrink-0 mt-0.5" />
      }
      <span>{children}</span>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────

const ENV_VARS = [
  { key: "CIRCLE_API_KEY", description: "Circle developer API key — from console.circle.com", required: true },
  { key: "CIRCLE_WALLET_SET_ID", description: "Circle wallet set UUID for developer-controlled wallets", required: true },
  { key: "CIRCLE_ENTITY_SECRET", description: "32-byte hex entity secret for signing (never expose to browser)", required: true },
  { key: "NEXT_PUBLIC_CIRCLE_APP_ID", description: "Public Circle App ID for browser SDK integration", required: true },
  { key: "NEXT_PUBLIC_ARC_TESTNET_RPC_URL", description: "Arc Testnet JSON-RPC endpoint URL", required: true },
  { key: "NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID", description: "Arc Testnet EVM chain ID (verify from docs.arc.network)", required: true },
  { key: "NEXT_PUBLIC_USDC_CONTRACT_ADDRESS", description: "USDC contract on Arc Testnet (native gas token)", required: true },
  { key: "NEXT_PUBLIC_EURC_CONTRACT_ADDRESS", description: "EURC ERC-20 contract on Arc Testnet", required: true },
  { key: "NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS", description: "Deployed MultiSend.sol contract address", required: false },
  { key: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", description: "WalletConnect Cloud project ID", required: true },
];

const CIRCLE_STEPS = [
  'Sign up at <a href="https://console.circle.com" target="_blank" class="text-brand-400 hover:underline">console.circle.com</a> and create an API key.',
  "Create a Developer-Controlled Wallet Set and note the Wallet Set ID.",
  "Generate a 32-byte entity secret: <code class='bg-surface-300 rounded px-1 py-0.5 text-xs'>openssl rand -hex 32</code> — store it securely.",
  "Upload your entity secret's public key ciphertext to Circle Console.",
  "Get your App ID from Circle Console → App Settings → set as <code class='bg-surface-300 rounded px-1 py-0.5 text-xs'>NEXT_PUBLIC_CIRCLE_APP_ID</code>.",
  "Fetch Circle token IDs for Arc Testnet via <code class='bg-surface-300 rounded px-1 py-0.5 text-xs'>GET /v1/w3s/token/catalog</code> and set them in <code class='bg-surface-300 rounded px-1 py-0.5 text-xs'>circle-adapter.ts</code>.",
];

const SECURITY_ITEMS = [
  "CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are server-side only — never sent to browser",
  "All wallet addresses validated with isAddress() from viem",
  "Amounts sanitized — only digits and single decimal point allowed",
  "CSV paste input sanitized against XSS (strips HTML tags, JS URIs, event handlers)",
  "Max batch size: 200 recipients — enforced in UI and smart contract",
  "Balance check before execution — insufficient tokens flagged pre-flight",
  "Smart contract uses custom errors for cheaper gas than require strings",
  "Excess native token refunded automatically in multisendNative",
];

const RESOURCES = [
  { label: "Arc Network Docs", desc: "docs.arc.network", url: "https://docs.arc.network" },
  { label: "Circle Developer Portal", desc: "developers.circle.com", url: "https://developers.circle.com" },
  { label: "Arc Block Explorer", desc: "testnet.arcscan.app", url: "https://testnet.arcscan.app" },
  { label: "WalletConnect Docs", desc: "docs.walletconnect.com", url: "https://docs.walletconnect.com" },
  { label: "Circle Testnet Faucet", desc: "Get testnet USDC/EURC", url: "https://faucet.circle.com" },
];