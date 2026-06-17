# Grove

Grove is a social layer on top of MOSS wallets.

Current Vercel deployment:

```text
https://grove-samarth-saxenas-projects.vercel.app
```

## Structure

- `next-app/` — Next.js web app, MOSS integration, Convex functions.
- `extension/` — planned Chrome extension surface for X.

## Web App

```bash
cd next-app
bun install
bun run dev
```

The app runs with HTTPS by default because MOSS/passkey flows need a secure browser context:

```text
https://localhost:3000
```

## Convex

The Convex dev deployment is configured in `next-app/.env.local`.

Useful commands:

```bash
cd next-app
convex dev
convex dev --once
convex dev --once --run seed:initialise
```

## Environment

Copy `next-app/.env.example` to `next-app/.env.local` when setting up a new machine.

```env
NEXT_PUBLIC_MOSS_NETWORK=testnet
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
CONVEX_DEPLOYMENT=
```

Development defaults to MOSS testnet. Mainnet should be an env change, not a code fork.

## Checks

```bash
cd next-app
bun run lint
bun run typecheck
bun run build
bun run smoke
```

Smoke test a deployed URL:

```bash
SMOKE_BASE_URL=https://grove-samarth-saxenas-projects.vercel.app bun run smoke
```

## Public Extension API

Resolve a verified public X handle into Grove profile data:

```text
GET /api/public/x/:handle
```

Example:

```bash
curl https://grove-samarth-saxenas-projects.vercel.app/api/public/x/miramakes
```

The response includes profile, reputation, recent public activity, and a `tipUrl`.
Unlinked, private, or unverified accounts return `404` with `{ "linked": false }`.
