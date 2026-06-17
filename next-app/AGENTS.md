<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Grove

Grove is a social layer on top of MOSS wallets.

## Product Idea

Build a website plus Chrome extension that lets users discover, follow, and interact with other MOSS wallets.

The core loop:

- Users sign in with MOSS.
- Users create a social profile tied to their MOSS wallet.
- Users can link and verify their X account.
- Users choose whether their activity is public, limited, or private.
- Users can follow other opted-in MOSS wallets.
- Users can see public activity from followed wallets: games played, wins, purchases, tips, app activity, and other decoded onchain events.
- Users can build and view reputation.
- Users can tip/pay other linked users with MOSS.

The goal is a community/social surface where wallet activity becomes a real, consent-aware social feed.

## Privacy and Consent

Raw chain activity may be public, but Grove should not treat identity linkage as public unless the user opts in.

Default posture:

- Do not publicly associate a wallet with an X account unless the user explicitly verifies and enables it.
- Do not show a user's activity in social feeds unless they opt into public or limited activity sharing.
- Let users hide activity, disconnect linked accounts, and make profiles private.
- Make public/private state obvious in the UI.

## Web App

Use the web app for the canonical MOSS integration:

- MOSS login and session creation.
- Profile creation.
- X account linking and verification.
- Privacy controls.
- Follow/unfollow.
- Activity feed.
- Reputation.
- Tip/payment page.
- Wallet-native actions should open the MOSS UI when appropriate.

Default to MOSS testnet during development, but keep the network configurable so the app can move to mainnet later.

Suggested env shape:

```env
NEXT_PUBLIC_MOSS_NETWORK=testnet
```

Backend verification should map MOSS networks to chain IDs:

- Mainnet: `4326`
- Testnet: `6343`

Current web app status:

- Main app route `/` is implemented with Grove/MOSS-inspired retro social UI.
- Profile pages exist at `/profile/[username]`.
- Tip fallback pages exist at `/tip/[username]`.
- Test/debug page exists at `/test`.
- App uses Convex for profiles, follows, activities, reputation votes, and tip intents.
- Demo data is seeded through Convex.
- Search, follow/unfollow, privacy toggle, X verification, profile pages, and simple reputation voting are implemented.
- Privacy selection uses optimistic local UI state so the selected pill moves immediately while Convex catches up.
- Public extension-facing X lookup exists at `/api/public/x/[handle]`.
- Production deployment exists on Vercel; local development runs on HTTPS because MOSS/passkeys require it.

Current sign-in behavior:

- The main Grove sign-in no longer uses raw `mega.authenticate()`.
- Raw `mega.authenticate()` showed a wallet warning because the default message says `Sign in to MegaETH` while the app origin is `localhost:3000`.
- Main sign-in now uses backend-generated Grove challenge signing:
  1. `POST /api/auth/challenge` creates a Grove message for the current origin and chain.
  2. Client calls `mega.signMessage(challenge.message)`.
  3. `POST /api/auth/verify` verifies with `@megaeth-labs/wallet-server-verify`.
- Keep `/test` available for raw SDK/JWT inspection; it may still trigger MOSS default-auth warnings and should not be treated as the main product sign-in path.
- This is still MVP auth plumbing. Proper app sessions/Convex auth are not finished yet.

Next required product work:

- First-sign-in onboarding is implemented on the homepage.
- Logged-out users can browse public Grove read-only.
- Signing in with MOSS creates/loads a shell profile, then onboarding requires display name.
- Avatar is optional; users pick from existing pixel avatars for now.
- Arbitrary username input is intentionally not allowed.
- New non-X users receive generated Grove handles like `g_929c2b_6517`.
- Verified X users use their X handle as their Grove username/profile URL.
- Real X OAuth starts at `POST /api/auth/x/start` and returns an X authorize URL.
- X OAuth callback is `/api/auth/x/callback`; configure this exact callback in the X Developer portal for each origin.
- Local callback: `https://localhost:3000/api/auth/x/callback`.
- Production callback: `https://grove-samarth-saxenas-projects.vercel.app/api/auth/x/callback`.
- X OAuth env currently reads `CLIENT_ID` and `CLIENT_SECRET`, with `X_CLIENT_ID` and `X_CLIENT_SECRET` supported as aliases.
- The callback exchanges the OAuth code server-side, fetches `/2/users/me`, then calls Convex `dashboard.linkVerifiedXByWallet` to set `xVerified: true`, `handleKind: "x"`, `xHandle`, `xUserId`, and `username`.
- `mockLinkX` remains as a local fallback only; do not use it as the normal product path when X OAuth is configured.
- The hardcoded demo wallet/profile path has been removed from the main homepage actions. The extension fallback tip route now requires a connected MOSS wallet instead of creating a demo draft.

## Backend and Indexer

The backend owns trust and social state:

- Wallet to profile mapping.
- Wallet to verified X account mapping.
- Follow graph.
- Privacy settings.
- Reputation state and voting rules.
- Activity indexing and decoding.
- Tip/payment intents and verification.

The reputation model will likely use the user's Karam design later. For early testing, simple upvote/downvote mechanics with lenient or unlimited limits are acceptable.

## Chrome Extension

The extension runs on X and adds Grove context to profiles or tweets.

Potential extension behavior:

- Detect X handles on profile pages and tweets.
- Query the Grove backend for linked MOSS wallet/profile data.
- Show reputation, linked-wallet status, and a tip/pay button when available.
- Let users tip someone directly from X if possible.

Preferred test path:

1. First test whether the extension can directly invoke the MOSS widget/SDK from an extension context.
2. If direct invocation is blocked by extension origins, iframe restrictions, passkey/WebAuthn origin issues, or CSP, fall back to opening a web app tip route.

Fallback flow:

```text
Extension tip button -> Grove web tip page -> MOSS payment flow
```

Direct extension invocation would be the best UX if it works, so it should be tested before committing to the fallback.

Current MOSS SDK notes relevant to extension testing:

- The SDK creates a fullscreen hidden iframe pointed at `https://account.megaeth.com`.
- The iframe bridge uses Penpal and allowlists the remote wallet origin.
- The iframe is created with WebAuthn permissions: `publickey-credentials-get *; publickey-credentials-create *`.
- This means MOSS passkey work likely happens inside the hosted wallet iframe, not inside the Grove extension origin directly.
- Direct extension invocation is plausible and worth testing, but not guaranteed.
- Likely failure points: extension iframe/WebAuthn behavior, MOSS backend origin checks, frame/CSP restrictions, and popup or side-panel lifecycle issues.
- Test direct invocation from an extension page or side panel before falling back.
- If direct extension invocation fails, prefer a small Grove HTTPS popup tip route over a full new tab.

Suggested extension test sequence:

1. Load the MOSS SDK in an extension page or side panel.
2. Call `mega.initialise({ network: 'testnet' })`.
3. Call `mega.status()`.
4. Call `mega.connect()` from explicit user intent.
5. Call `mega.authenticate()` and inspect the returned JWT origin.
6. Test backend verification for the returned JWT.
7. Test a small testnet payment/tip flow.

## MOSS Integration Notes

Use the installed `moss-wallet` skill for implementation details.

Important defaults:

- Use `network: 'testnet'` during development.
- Keep the network switchable via env.
- Initialise MOSS once at app boot or mount one stable `MegaProvider`.
- Treat `cancelled` as neutral user intent.
- Use backend verification before issuing sessions.
- Use explicit user consent before payments.
- Use `silent: true` only after a matching user-approved permission grant exists.
- Keep sponsorship, auth verification, risk checks, and escalation backend-owned.

## MVP Scope

Build the smallest version that proves the concept:

- MOSS testnet sign-in.
- Basic profile.
- Link or mock-link X account.
- Public/private activity toggle.
- Follow/unfollow profiles.
- Basic feed using mocked or lightly indexed events.
- Simple reputation upvote/downvote.
- Tip page using MOSS testnet.
- Chrome extension that detects X handles and shows Grove UI for linked users.
- Experiment with direct MOSS invocation from the extension.

## Open Questions

- Can MOSS SDK/widget be invoked directly from a Chrome extension page or content script?
- Does MOSS/passkey auth require a normal web origin, or can extension origins work?
- Should tipping happen from an extension popup, injected content UI, or a web app route?
- What activity categories should be public by default after opt-in?
- How should Karam reputation be adapted to MOSS wallets and X-linked identities?
- Will the app need sponsorship/paymaster support for onboarding or tipping?

Use bun, not npm or pnpm or yarn. Only bun.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`bun x convex ai-files install`.

<!-- convex-ai-end -->
