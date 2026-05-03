# Sender MultiSend — Production Deployment Guide

A gas-optimized batch token distribution dApp for Arc Testnet, supporting Circle USDC & EURC.

---

## 🏗 Architecture

```
Frontend (Next.js 14 App Router)
  ↓
Wallet Layer (wagmi v2 + viem + MetaMask/WalletConnect)
  ↓
Blockchain Adapter Layer
  ├── provider.ts         → Arc Testnet RPC (viem PublicClient / WalletClient)
  ├── multisend.ts        → MultiSend contract interaction + sequential fallback
  ├── tokens.ts           → ERC-20 ABI, token registry, formatters
  └── circle-adapter.ts  → Circle SDK adapter (server-side, plug-in)
  ↓
Arc Testnet (EVM-compatible)
  └── MultiSend.sol contract (optional, falls back to sequential if not deployed)
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd Sender-multisend
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
# Fill in all values (see .env.example for instructions)
```

### 3. Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

---

## 📋 Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `CIRCLE_API_KEY` | Circle developer API key | [console.circle.com](https://console.circle.com) → API Keys |
| `CIRCLE_WALLET_SET_ID` | Wallet Set UUID | Circle Console → Wallets → Wallet Sets |
| `CIRCLE_ENTITY_SECRET` | 32-byte hex signing key | `openssl rand -hex 32` |
| `NEXT_PUBLIC_CIRCLE_APP_ID` | Public Circle App ID | Circle Console → App Settings |
| `NEXT_PUBLIC_ARC_TESTNET_RPC_URL` | Arc Testnet RPC endpoint | [docs.arc.network](https://docs.arc.network) |
| `NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID` | Arc Testnet chain ID | [docs.arc.network](https://docs.arc.network) |
| `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` | USDC on Arc Testnet | Circle / Arc docs |
| `NEXT_PUBLIC_EURC_CONTRACT_ADDRESS` | EURC on Arc Testnet | Circle / Arc docs |
| `NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS` | MultiSend.sol address | Deploy yourself (see below) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Project ID | [cloud.walletconnect.com](https://cloud.walletconnect.com) |

---

## 📄 Deploy MultiSend Contract

The MultiSend contract enables gas-efficient batching. Without it, the app falls back to sequential transfers automatically.

### Install Hardhat dependencies

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
```

### Deploy to Arc Testnet

```bash
# Add deployer private key to .env.local:
# DEPLOYER_PRIVATE_KEY=0x...

npx hardhat run scripts/deploy.ts --network arc-testnet
```

The script prints the deployed address. Add it to `.env.local`:

```
NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS=0x...
```

---

## ☁️ Deploy to Vercel

### Option A: Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

### Option B: Vercel Dashboard

1. Push repo to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables in Project → Settings → Environment Variables
4. Deploy

### Critical: Server-side env vars

In Vercel dashboard, add these as **Environment Variables** (NOT prefixed with `NEXT_PUBLIC_`):

- `CIRCLE_API_KEY`
- `CIRCLE_WALLET_SET_ID`
- `CIRCLE_ENTITY_SECRET`

These are used only in API Routes and are never sent to the browser.

---

## 🔌 Circle SDK Integration

The adapter at `src/lib/blockchain/circle-adapter.ts` currently uses raw `fetch` calls against Circle's REST API. 

### To upgrade to the official SDK:

```bash
npm install @circle-fin/developer-controlled-wallets
```

Then replace the `fetch` calls in `circle-adapter.ts` with:

```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

// List wallets
const { data } = await client.listWallets({ walletSetId: process.env.CIRCLE_WALLET_SET_ID });

// Get balance
const { data } = await client.getWalletTokenBalance({ id: walletId });

// Create transfer
const { data } = await client.createTransaction({
  walletId: sourceWalletId,
  tokenId: circleTokenId,
  destinationAddress,
  amounts: [amount],
  feeLevel: "MEDIUM",
});
```

---

## 🔒 Security Checklist

- [x] `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` are server-side only
- [x] All wallet addresses validated with `isAddress()` (viem)
- [x] Amounts sanitized — only digits and single decimal point allowed
- [x] CSV paste input sanitized against XSS (strips HTML tags, JS URIs, event handlers)
- [x] Max batch size: 200 recipients (enforced in UI + smart contract)
- [x] Balance check before execution — insufficient tokens flagged pre-flight
- [x] Smart contract uses custom errors (cheaper gas than `require` strings)
- [x] Excess ETH refunded in `multisendNative`

---

## 🏗 Project Structure

```
Sender-multisend/
├── contracts/
│   └── MultiSend.sol              # Batch transfer contract
├── scripts/
│   └── deploy.ts                  # Hardhat deploy script
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Landing page
│   │   ├── globals.css
│   │   └── app/
│   │       ├── layout.tsx         # App shell
│   │       ├── page.tsx           # Dashboard
│   │       ├── history/page.tsx   # Transaction history
│   │       ├── docs/page.tsx      # Integration guide
│   │       └── address-book/     # Address book
│   ├── components/
│   │   ├── ui/                    # Button, Input, Badge, TokenLogo, TokenSelector
│   │   ├── layout/                # AppHeader, WalletConnectButton, Providers
│   │   └── dashboard/             # TokenBalanceCards, RecipientsTable, SummaryPanel, CsvPasteModal
│   ├── lib/
│   │   ├── blockchain/            # provider, tokens, multisend, circle-adapter
│   │   ├── hooks/                 # use-token-balances, use-batch-execution
│   │   ├── store/                 # batch-store (Zustand)
│   │   ├── utils/                 # csv, validation
│   │   └── wagmi-config.ts
│   └── types/index.ts
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── hardhat.config.ts
└── package.json
```

---

## ⚠️ Arc Testnet Notes

- Confirm the Chain ID from [docs.arc.network](https://docs.arc.network) (placeholder: `12321`)
- Confirm the RPC URL endpoint
- Arc Testnet may require native ARC tokens for gas — get from the Arc faucet
- Token contract addresses for USDC/EURC on Arc Testnet must be obtained from Circle or Arc docs

---

## 📊 CSV Format

Upload or paste CSV in this format:

```
wallet_address,amount,token
0x1234...abcd,10.50,USDC
0xabcd...1234,5.00,EURC
0x9876...dcba,1.0,ETH
```

- Column order: `address`, `amount`, `token` (token is optional, defaults to USDC)
- Header row is optional and auto-detected
- Download the Excel template from the Dashboard for a pre-formatted starting point

---

## 📞 Support

- Arc Network: [docs.arc.network](https://docs.arc.network)
- Circle Docs: [developers.circle.com](https://developers.circle.com)
- WalletConnect: [docs.walletconnect.com](https://docs.walletconnect.com)
