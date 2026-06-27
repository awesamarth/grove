import { ExternalLink } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link href="/" className="mb-8 flex items-center gap-2 text-sm text-muted hover:text-text">
        ← Back to Grove
      </Link>

      <h1 className="text-4xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: June 27, 2026</p>

      <div className="mt-10 space-y-8 text-[15px] leading-7 text-text/85">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-text">1. What We Collect</h2>
          <p>
            Grove collects and stores the following data when you use the website, browser extension, and API:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Wallet address</strong> — Your MegaETH wallet address, collected when you sign in
              with MOSS. This is used as your primary identifier on Grove.
            </li>
            <li>
              <strong>Profile information</strong> — Display name, bio, avatar, and username that you
              choose to provide.
            </li>
            <li>
              <strong>X account linkage</strong> — If you choose to verify your X (Twitter) account, we
              store your X handle, user ID, and profile image. This is done only with your explicit
              consent via X OAuth.
            </li>
            <li>
              <strong>Onchain activity</strong> — Public transaction data from MegaETH for wallets that
              opt into activity sharing. This includes trades, game results, and other app interactions.
            </li>
            <li>
              <strong>Social graph</strong> — Follow relationships, karma votes, and tip intents that
              you create on Grove.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-text">2. How We Use Data</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>To display your profile and activity to other Grove users (based on your privacy settings).</li>
            <li>To show your Grove profile data (karma, linked wallet) on X profiles via the browser extension.</li>
            <li>To enable social features: follow, tip, karma voting, and notifications.</li>
            <li>To index onchain activity from opted-in wallets and associate it with your profile.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-text">3. Data Sharing</h2>
          <p>
            We do not sell or transfer your personal data to third parties. Public data (your profile,
            public activity, karma) is visible to other Grove users as governed by your privacy settings.
            Wallet addresses and onchain activity are inherently public on the MegaETH blockchain; Grove
            simply indexes and displays this data in a social context.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-text">4. Data Storage</h2>
          <p>
            Data is stored on Convex Cloud (US-based). We retain your data for as long as your account
            exists. You can delete your profile and associated data at any time by contacting us.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-text">5. Browser Extension</h2>
          <p>
            The Grove Chrome extension requires the following permissions:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>sidePanel</strong> — Shows a sidebar with your wallet activity and tip links.
            </li>
            <li>
              <strong>storage</strong> — Stores your Grove session token locally so you stay signed in.
            </li>
            <li>
              <strong>identity</strong> — Used for MOSS wallet authentication via
              chrome.identity.launchWebAuthFlow.
            </li>
            <li>
              <strong>clipboardRead</strong> — Used only on Euphoria pages to capture trade images from
              the native clipboard.
            </li>
            <li>
              <strong>Host permissions (x.com, twitter.com)</strong> — Injects Grove profile data onto X
              profile pages and tweets.
            </li>
            <li>
              <strong>Host permissions (euphoria.finance)</strong> — Injects a "Share on Grove" button
              on trade result modals.
            </li>
            <li>
              <strong>Host permissions (ongrove.network)</strong> — Fetches profile, karma, and tip data
              from Grove API.
            </li>
          </ul>
          <p className="mt-3">
            The extension does not read your browsing history, track your activity on other sites, or
            collect any data beyond what is listed above.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-text">6. Your Choices</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Set your profile and activity visibility to public, limited, or private.</li>
            <li>Unlink your X account at any time.</li>
            <li>Delete your profile and all associated data.</li>
            <li>Opt out of onchain activity indexing.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-text">7. Contact</h2>
          <p>
            For questions about this policy, data deletion requests, or support, reach out via X at{" "}
            <a
              href="https://x.com/ongrove_network"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              @ongrove_network <ExternalLink size={12} />
            </a>{" "}
            or open an issue on{" "}
            <a
              href="https://github.com/awesamarth/grove"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              GitHub <ExternalLink size={12} />
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
