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

The memo field in **Create Operation** is optional: leaving it empty stores `memoCID = ""` on-chain and
never calls Pinata, so the escrow flow never depends on IPFS being available.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
