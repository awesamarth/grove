"use client";

import { mega, useConnect, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useState } from "react";

type JwtPart = Record<string, unknown>;

type JwtInspection = {
  header: JwtPart;
  payload: JwtPart;
  issuedAt: string | null;
  expiresAt: string | null;
  lifetimeSeconds: number | null;
  remainingSeconds: number | null;
  tokenLength: number;
};

function decodeJwtPart(part: string): JwtPart {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as JwtPart;
}

function unixDate(value: unknown) {
  return typeof value === "number"
    ? new Date(value * 1000).toISOString()
    : null;
}

function inspectJwt(jwt: string): JwtInspection {
  const parts = jwt.split(".");

  if (parts.length !== 3) {
    throw new Error(`Expected a 3-part JWT, received ${parts.length} parts`);
  }

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  const issuedAt = typeof payload.iat === "number" ? payload.iat : null;
  const expiresAt = typeof payload.exp === "number" ? payload.exp : null;

  return {
    header,
    payload,
    issuedAt: unixDate(issuedAt),
    expiresAt: unixDate(expiresAt),
    lifetimeSeconds:
      issuedAt !== null && expiresAt !== null ? expiresAt - issuedAt : null,
    remainingSeconds:
      expiresAt !== null ? expiresAt - Math.floor(Date.now() / 1000) : null,
    tokenLength: jwt.length,
  };
}

export function MossWalletControls() {
  const { initialised, status, address, network } = useStatus();
  const [openError, setOpenError] = useState<string>();
  const [authPending, setAuthPending] = useState(false);
  const [authInspection, setAuthInspection] = useState<JwtInspection>();
  const [authError, setAuthError] = useState<string>();
  const connect = useConnect();

  async function openWallet() {
    setOpenError(undefined);

    try {
      await mega.open();
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : "Could not open MOSS");
    }
  }

  async function inspectAuthJwt() {
    setAuthPending(true);
    setAuthError(undefined);
    setAuthInspection(undefined);

    try {
      const result = await mega.authenticate();

      if (result.status === "cancelled") {
        setAuthError("Authentication was cancelled.");
        return;
      }

      if (result.status === "error" || !result.jwt) {
        setAuthError(result.error ?? "MOSS did not return a JWT.");
        return;
      }

      const inspection = inspectJwt(result.jwt);
      setAuthInspection(inspection);
      console.info("MOSS JWT inspection (token omitted)", inspection);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not inspect JWT");
    } finally {
      setAuthPending(false);
    }
  }

  return (
    <section className="mt-8 w-full max-w-sm border-t border-border pt-5 text-left">
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="font-mono uppercase text-muted">{network}</span>
        <span className="text-muted">
          {!initialised ? "Initialising" : status}
        </span>
      </div>

      {address ? (
        <p className="mt-3 truncate font-mono text-xs text-text">{address}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!initialised || connect.isPending}
          onClick={() => connect.mutate()}
          className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {connect.isPending ? "Connecting" : "Connect"}
        </button>
        <button
          type="button"
          disabled={!initialised}
          onClick={openWallet}
          className="h-11 rounded-lg border border-text bg-panel px-4 text-sm font-medium text-text transition-colors hover:bg-panel-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open MOSS
        </button>
      </div>

      <button
        type="button"
        disabled={!initialised || status !== "connected" || authPending}
        onClick={inspectAuthJwt}
        className="mt-2 h-11 w-full rounded-lg bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {authPending ? "Authenticating" : "Inspect auth JWT"}
      </button>

      {connect.error || openError || authError ? (
        <p className="mt-3 text-xs text-danger">
          {connect.error?.message ?? openError ?? authError}
        </p>
      ) : null}

      {authInspection ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 font-mono text-xs uppercase text-muted">
            Decoded JWT, token omitted
          </p>
          <pre className="max-h-96 overflow-auto rounded-lg bg-panel p-3 font-mono text-[11px] leading-5 text-text">
            {JSON.stringify(authInspection, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
