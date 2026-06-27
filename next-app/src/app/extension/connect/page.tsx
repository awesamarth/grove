"use client";

import { Check, Loader2, X } from "lucide-react";
import { mega, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { notifyGroveSessionChanged, useGroveSession } from "@/lib/use-grove-session";

type AuthChallenge = {
  token?: string;
  message?: string;
  error?: string;
};

function isAllowedRedirect(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
}

function redirectWithSession(redirectUri: string, token: string, walletAddress: string) {
  const url = new URL(redirectUri);
  url.hash = new URLSearchParams({
    token,
    walletAddress,
    source: "grove-extension",
  }).toString();
  window.location.assign(url.toString());
}

export default function ExtensionConnectPage() {
  return <Suspense fallback={null}><ConnectContent /></Suspense>;
}

function ConnectContent() {
  const params = useSearchParams();
  const redirectUri = params.get("redirect_uri");
  const { status, address } = useStatus();
  const groveSession = useGroveSession();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Connect your MOSS wallet to Grove.");
  const [error, setError] = useState<string>();
  const redirectAllowed = useMemo(() => isAllowedRedirect(redirectUri), [redirectUri]);

  useEffect(() => {
    if (!redirectAllowed || !redirectUri || !groveSession.authenticated || !groveSession.token || !groveSession.walletAddress) {
      return;
    }
    setMessage("Returning to the Grove extension.");
    redirectWithSession(redirectUri, groveSession.token, groveSession.walletAddress);
  }, [groveSession.authenticated, groveSession.token, groveSession.walletAddress, redirectAllowed, redirectUri]);

  async function connect() {
    if (!redirectAllowed || !redirectUri) {
      setError("Invalid extension redirect.");
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      let walletAddress = address;
      setMessage("Opening MOSS.");

      if (status !== "connected") {
        const connection = await mega.connect();
        if (connection.status === "cancelled") {
          setMessage("Connection cancelled.");
          return;
        }
        if (connection.status !== "connected") {
          throw new Error("MOSS wallet could not connect.");
        }
        walletAddress = connection.address;
      }

      if (!walletAddress) {
        throw new Error("MOSS wallet did not return an address.");
      }

      setMessage("Requesting Grove sign-in challenge.");
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: walletAddress }),
      });
      const challenge = (await challengeResponse.json()) as AuthChallenge;
      if (!challengeResponse.ok || !challenge.token || !challenge.message) {
        throw new Error(challenge.error ?? "Could not create Grove sign-in challenge.");
      }

      setMessage("Sign the Grove challenge in MOSS.");
      const signed = await mega.signMessage(challenge.message);
      if (signed.status === "cancelled") {
        setMessage("Sign-in cancelled.");
        return;
      }
      if (signed.status === "error" || !signed.signature) {
        throw new Error(signed.error ?? "MOSS authentication failed.");
      }

      setMessage("Verifying Grove session.");
      const verification = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: challenge.token, signature: signed.signature }),
      });
      const verificationBody = (await verification.json()) as { walletAddress?: string; error?: string };
      if (!verification.ok || !verificationBody.walletAddress) {
        throw new Error(verificationBody.error ?? "MOSS authentication could not be verified.");
      }

      await groveSession.refresh();
      notifyGroveSessionChanged();
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const session = (await sessionResponse.json()) as {
        authenticated?: boolean;
        walletAddress?: string | null;
        token?: string | null;
      };
      if (!session.authenticated || !session.walletAddress || !session.token) {
        throw new Error("Grove session was not created.");
      }

      setMessage("Returning to the Grove extension.");
      redirectWithSession(redirectUri, session.token, session.walletAddress);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect Grove extension.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-text">
      <section className="w-full max-w-md overflow-hidden rounded-lg border border-text/15 bg-panel shadow-[0_24px_80px_rgb(5_32_13/0.12)]">
        <div className="border-b border-border p-5">
          <p className="font-mono text-[11px] uppercase text-muted">Grove extension</p>
          <h1 className="mt-1 text-2xl font-medium">Connect Grove</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Sign in once on Grove so the browser sidebar can show your profile and karma.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-md border border-border bg-background p-3 text-sm text-muted">
            {message}
          </div>

          {!redirectAllowed ? (
            <div className="flex items-start gap-2 rounded-md border border-danger bg-danger-muted p-3 text-sm text-danger">
              <X size={16} />
              <span>Invalid extension redirect. Start this flow from the Grove extension.</span>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-danger bg-danger-muted p-3 text-sm text-danger">
              <X size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          {groveSession.authenticated && groveSession.walletAddress ? (
            <div className="flex items-center gap-2 rounded-md border border-primary bg-primary-muted p-3 text-sm text-primary">
              <Check size={16} />
              <span>Signed in as {groveSession.walletAddress.slice(0, 8)}...{groveSession.walletAddress.slice(-6)}</span>
            </div>
          ) : null}

          <button
            type="button"
            disabled={pending || !redirectAllowed}
            onClick={() => void connect()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="animate-spin" size={16} /> : null}
            {pending ? "Connecting" : "Connect with MOSS"}
          </button>
        </div>
      </section>
    </main>
  );
}
