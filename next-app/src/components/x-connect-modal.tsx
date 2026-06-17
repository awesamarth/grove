"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type XConnectContextValue = {
  openXConnect: () => void;
};

const XConnectContext = createContext<XConnectContextValue | null>(null);

export function useXConnect() {
  const context = useContext(XConnectContext);
  if (!context) {
    throw new Error("useXConnect must be used inside XConnectProvider");
  }
  return context;
}

export function XConnectProvider({ children }: { children: ReactNode }) {
  const { address } = useStatus();
  const mockLinkX = useMutation(api.dashboard.mockLinkX);
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState(false);
  const [devFallbackOpen, setDevFallbackOpen] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    setError(undefined);
    setDevFallbackOpen(false);
  }

  async function connectX() {
    if (!address) {
      setError("Connect MOSS before linking X.");
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      const response = await fetch("/api/auth/x/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const body = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !body.url) {
        throw new Error(body.error ?? "Could not start X verification.");
      }

      window.location.assign(body.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start X verification.");
      setDevFallbackOpen(true);
      setPending(false);
    }
  }

  async function submitMock() {
    if (!address) return;
    setPending(true);
    setError(undefined);

    try {
      await mockLinkX({
        devWalletAddress: address,
        xHandle: handle,
      });
      setHandle("");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect X.");
    } finally {
      setPending(false);
    }
  }

  return (
    <XConnectContext.Provider value={{ openXConnect: () => setOpen(true) }}>
      {children}
      {open ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-dark/35 px-4 backdrop-blur-sm"
          onMouseDown={close}
        >
          <div
            className="w-full max-w-[420px] overflow-hidden rounded-lg border border-text/20 bg-panel shadow-[0_24px_80px_rgb(5_32_13/0.25)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border p-5">
              <p className="font-mono text-[11px] uppercase text-muted">Connect X</p>
              <h2 className="mt-1 text-2xl font-medium">Claim your Grove handle</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Verify your X account once. Grove will use your X handle as your username.
              </p>
            </div>

            <div className="space-y-4 p-5">
              {error ? (
                <p className="rounded-md border border-danger bg-danger-muted px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="h-10 rounded-md border border-border bg-background px-4 text-sm font-medium text-muted transition-colors hover:border-text hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending || !address}
                  onClick={connectX}
                  className="flex h-10 items-center justify-center rounded-md bg-dark px-4 text-sm font-medium leading-none text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Opening X" : "Connect X"}
                </button>
              </div>

              {devFallbackOpen ? (
                <div className="border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setDevFallbackOpen((value) => !value)}
                    className="font-mono text-[11px] uppercase text-muted hover:text-text"
                  >
                    Dev mock fallback
                  </button>
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <input
                      value={handle}
                      onChange={(event) => setHandle(event.target.value)}
                      placeholder="@awesamarth"
                      className="h-10 min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted focus:border-primary"
                    />
                    <button
                      type="button"
                      disabled={pending || handle.trim().length < 1}
                      onClick={submitMock}
                      className="h-10 rounded-md border border-text/15 bg-panel px-3 text-sm font-medium text-text transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mock verify
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </XConnectContext.Provider>
  );
}
