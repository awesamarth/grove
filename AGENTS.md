# Grove

Grove is a social layer on top of MOSS wallets.

The active web app lives in `next-app/`. Run app commands from there unless working on repo-level structure.

Use bun only. Do not use npm, pnpm, or yarn.

For product, privacy, MOSS, Convex, and Next.js rules, read `next-app/AGENTS.md` before editing the app.

Planned repo shape:

- `next-app/` for the website and Convex backend.
- `extension/` for the Chrome extension once the web app/auth surfaces are solid.

Current next priority: wire real X OAuth in `next-app/`. First-sign-in onboarding now exists with required display name, optional avatar, generated Grove handles, and mocked X verification that promotes a verified X handle into the Grove username.
