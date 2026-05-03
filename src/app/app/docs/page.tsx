import { BookOpen, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <BookOpen className="h-6 w-6 text-brand-400" />
          Integration Guide
        </h1>
        <p className="mt-2 text-gray-400">
          Everything you need to set up Sender MultiSend for production use on Arc Testnet.
        </p>
      </div>

      <DocSection title="1. Environment Setup">
        <p className="text-sm text-gray-400 mb-4">
          Copy <code className="code">.env.example</code> to <code className="code">.env.local</code> and fill in the following:
        </p>
        <EnvTable vars={ENV_VARS} />
      </DocSection>

      <DocSection title="2. Arc Testnet Configuration">
        <p className="text-sm text-gray-400 mb-3">
          Arc Testnet is an EVM-compatible blockchain. Confirm the correct Chain ID and RPC URL from{" "}
          <a href="https://docs.arc.network" target="_blank" rel="noopener" className="text-brand-400 hover:underline">
            docs.arc.network
          </a>{" "}
          then update <code className="code">NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID</code> and{" "}
          <code className="code">NEXT_PUBLIC_ARC_TESTNET_RPC_URL</code>.
        </p>
        <InfoBox type="warning">
          The chain ID <code>12321</code> is a placeholder. Verify the actual Arc Testnet chain ID before deploying.
        </InfoBox>
      </DocSection>

      <DocSection title="3. Circle SDK Setup">
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
          The Circle adapter at <code>src/lib/blockchain/circle-adapter.ts</code> is fully typed and isolated.
          Replace the <code>fetch</code> calls with the official <code>@circle-fin/developer-controlled-wallets</code> SDK when available.
        </InfoBox>
      </DocSection>

      <DocSection title="4. MultiSend Contract Deployment">
        <p className="text-sm text-gray-400 mb-3">
          The contract at <code className="code">contracts/MultiSend.sol</code> provides gas-optimized batch transfers.
          Deploy it to Arc Testnet using Hardhat or Foundry:
        </p>
        <CodeBlock lang="bash">{`# Hardhat
npx hardhat run scripts/deploy.ts --network arc-testnet

# Foundry
forge create contracts/MultiSend.sol:MultiSend \\
  --rpc-url $NEXT_PUBLIC_ARC_TESTNET_RPC_URL \\
  --private-key $DEPLOYER_PRIVATE_KEY`}</CodeBlock>
        <p className="text-sm text-gray-400 mt-3">
          Set the deployed address in <code className="code">NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS</code>.
          If this variable is not set (equals <code>0x000...000</code>), the app falls back to sequential ERC-20 transfers automatically.
        </p>
      </DocSection>

      <DocSection title="5. Token Contract Addresses">
        <p className="text-sm text-gray-400 mb-3">
          USDC and EURC must be deployed or located on Arc Testnet. Once you have the addresses, set:
        </p>
        <CodeBlock lang="bash">{`NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_EURC_CONTRACT_ADDRESS=0x...`}</CodeBlock>
        <InfoBox type="info" className="mt-3">
          Contact Circle via their developer portal to get testnet USDC/EURC faucet access for Arc Testnet.
        </InfoBox>
      </DocSection>

      <DocSection title="6. Vercel Deployment">
        <CodeBlock lang="bash">{`# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set env vars via Vercel dashboard or CLI:
vercel env add CIRCLE_API_KEY production
vercel env add CIRCLE_WALLET_SET_ID production
vercel env add CIRCLE_ENTITY_SECRET production`}</CodeBlock>
        <InfoBox type="warning" className="mt-3">
          Never expose <code>CIRCLE_API_KEY</code>, <code>CIRCLE_ENTITY_SECRET</code>, or{" "}
          <code>CIRCLE_WALLET_SET_ID</code> to the browser. These are server-side only.
        </InfoBox>
      </DocSection>

      <DocSection title="7. Architecture Overview">
        <pre className="overflow-x-auto rounded-xl border border-surface-400 bg-surface-200 p-4 text-xs text-gray-300 leading-relaxed">{ARCH_DIAGRAM}</pre>
      </DocSection>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
      <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-surface-400 bg-surface-200 p-4 text-xs text-gray-300">
      <code>{children}</code>
    </pre>
  );
}

function EnvTable({ vars }: { vars: { key: string; description: string; required: boolean }[] }) {
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
                {v.required ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <span className="text-xs text-gray-600">Optional</span>
                )}
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
      {type === "warning" ? (
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <BookOpen className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <span>{children}</span>
    </div>
  );
}

const ENV_VARS = [
  { key: "CIRCLE_API_KEY", description: "Circle developer API key — from console.circle.com", required: true },
  { key: "CIRCLE_WALLET_SET_ID", description: "Circle wallet set UUID for developer-controlled wallets", required: true },
  { key: "CIRCLE_ENTITY_SECRET", description: "32-byte hex entity secret for signing (never expose to browser)", required: true },
  { key: "NEXT_PUBLIC_CIRCLE_APP_ID", description: "Public Circle App ID for browser SDK integration", required: true },
  { key: "NEXT_PUBLIC_ARC_TESTNET_RPC_URL", description: "Arc Testnet JSON-RPC endpoint URL", required: true },
  { key: "NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID", description: "Arc Testnet EVM chain ID (verify from docs.arc.network)", required: true },
  { key: "NEXT_PUBLIC_USDC_CONTRACT_ADDRESS", description: "USDC ERC-20 contract on Arc Testnet", required: true },
  { key: "NEXT_PUBLIC_EURC_CONTRACT_ADDRESS", description: "EURC ERC-20 contract on Arc Testnet", required: true },
  { key: "NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS", description: "Deployed MultiSend.sol contract address (fallback to sequential if unset)", required: false },
  { key: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", description: "WalletConnect Cloud project ID — cloud.walletconnect.com", required: true },
];

const CIRCLE_STEPS = [
  'Sign up at <a href="https://console.circle.com" target="_blank" class="text-brand-400 hover:underline">console.circle.com</a> and create an API key.',
  "Create a Developer-Controlled Wallet Set for your app and note the Wallet Set ID.",
  "Generate a 32-byte entity secret: <code class='bg-surface-300 rounded px-1 py-0.5 text-xs'>openssl rand -hex 32</code> — store it securely.",
  "Upload your entity secret's public key ciphertext to Circle Console (see Circle docs for the RSA encryption step).",
  "Get your App ID from Circle Console → App Settings and set it as <code class='bg-surface-300 rounded px-1 py-0.5 text-xs'>NEXT_PUBLIC_CIRCLE_APP_ID</code>.",
  "Fetch Circle token IDs for Arc Testnet via <code class='bg-surface-300 rounded px-1 py-0.5 text-xs'>GET /v1/w3s/token/catalog</code> and set them in <code class='bg-surface-300 rounded px-1 py-0.5 text-xs'>circle-adapter.ts</code>.",
];

const ARCH_DIAGRAM = `
src/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout + Providers
│   ├── page.tsx                 # Landing page
│   └── app/
│       ├── layout.tsx           # Dashboard shell + AppHeader
│       ├── page.tsx             # Dashboard (main UI)
│       ├── history/page.tsx     # Transaction history
│       └── docs/page.tsx        # This page
│
├── components/
│   ├── ui/                      # Primitive UI components
│   ├── layout/                  # Header, WalletConnectButton, Providers
│   └── dashboard/               # Feature components (table, summary, CSV modal)
│
├── lib/
│   ├── blockchain/
│   │   ├── provider.ts          # Arc Testnet viem client + chain config
│   │   ├── tokens.ts            # Token registry + ERC-20 ABI + formatters
│   │   ├── multisend.ts         # Batch execution logic + MultiSend ABI
│   │   └── circle-adapter.ts   # Circle API adapter (plug-in, replaceable)
│   ├── hooks/
│   │   ├── use-token-balances.ts  # TanStack Query: on-chain balances
│   │   └── use-batch-execution.ts # useMutation: validate + execute batch
│   ├── store/
│   │   └── batch-store.ts       # Zustand: recipients, history, address book
│   ├── utils/
│   │   ├── csv.ts               # CSV/XLSX parse + export
│   │   └── validation.ts        # Address + amount validators
│   └── wagmi-config.ts          # wagmi v2 config (MetaMask + WalletConnect)
│
└── types/index.ts               # All domain TypeScript types
`;
