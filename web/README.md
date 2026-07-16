This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment variables

Copy `.env.example` to `.env.local` (gitignored) and fill in:

- **`PINATA_JWT`** — server-side secret used by the `POST /api/upload-ipfs` route to pin operation
  memos to IPFS. Get it from [app.pinata.cloud](https://app.pinata.cloud) → **API Keys** → create a
  key → copy the **JWT**. Never prefix it with `NEXT_PUBLIC_` (that would leak it to the browser); the
  upload runs server-side precisely so the key stays secret.
- **`NEXT_PUBLIC_IPFS_GATEWAY`** — public IPFS gateway used to _read_ memos back (safe to expose).
  Defaults to `https://gateway.pinata.cloud/ipfs/` if unset. For best reliability use your dedicated
  Pinata gateway: `https://<your-subdomain>.mypinata.cloud/ipfs/`.
- **`LOGS_RPC_URL`** — server-side RPC used by the `GET /api/timeline` event indexer to scan logs.
  Defaults to `http://localhost:8545`. Not `NEXT_PUBLIC_` on purpose: the indexer runs server-side, so
  the RPC URL is never exposed to the browser (in M8 this was public because scanning ran client-side).
  For Sepolia (Fase 2) use `https://sepolia.drpc.org` (no key).
- **`LOG_WINDOW_SIZE`** — block window size for the paginated log scan. Defaults to `50000`. Local Anvil
  has few blocks so it barely matters; on Sepolia via dRPC keep it around `9000` (free-tier limit).

### Contract addresses

The contract addresses and chain id come from `NEXT_PUBLIC_*` env vars (they are `NEXT_PUBLIC_` because
the **browser** needs them — reads/writes go straight from the client — unlike `LOGS_RPC_URL`, which is
server-only). `web/lib/contracts.ts` reads them with **Anvil defaults as fallback**:

- **`NEXT_PUBLIC_ESCROW_ADDRESS`** — Escrow contract address.
- **`NEXT_PUBLIC_TKA_ADDRESS`** / **`NEXT_PUBLIC_TKB_ADDRESS`** — the two allowlisted test tokens.
- **`NEXT_PUBLIC_CHAIN_ID`** — expected chain id (`31337` Anvil, `11155111` Sepolia).
- **`NEXT_PUBLIC_DEPLOY_BLOCK`** — block the Escrow was deployed at; the `/api/timeline` indexer scans
  from here (never from 0).

**Local:** you do **not** configure these by hand. `./deploy.sh` writes them to `web/.env.development.local`
(gitignored, auto-generated), which `next dev` loads with priority over `.env.local` — so the
`anvil → ./deploy.sh → pnpm dev` flow works out of the box (and even without that file, the deterministic
Anvil defaults in `contracts.ts` already match). `.env.local` (your `PINATA_JWT`) is never touched.

**Sepolia / Vercel:** set these five vars in the Vercel dashboard (Project → Settings → Environment
Variables). They override the defaults at build time; no code changes needed.

The memo field in **Create Operation** is optional: leaving it empty stores `memoCID = ""` on-chain and
never calls Pinata, so the escrow flow never depends on IPFS being available. Likewise the **Activity**
timeline (fed by `/api/timeline`) degrades gracefully if the RPC is unavailable — it never crashes the page.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
