"use client";

import { useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useXConnect } from "./x-connect-modal";

export function XConnectBanner() {
  const { address } = useStatus();
  const { openXConnect } = useXConnect();
  const dashboard = useQuery(
    api.dashboard.getDashboard,
    address ? { viewerWallet: address } : "skip",
  );
  const viewer = dashboard?.viewer;

  if (!address || !viewer?.onboardingComplete || viewer.xVerified) {
    return null;
  }

  return (
    <section className="border-b border-text/15 bg-panel/95">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <p className="text-sm leading-5 text-text">
          <span className="font-medium">Connect X to claim your handle.</span>{" "}
          <span className="text-muted">Your verified X handle becomes your Grove username.</span>
        </p>
        <button
          type="button"
          onClick={openXConnect}
          className="flex h-8 items-center justify-center rounded-md border border-primary bg-background px-3 text-sm font-medium leading-none text-primary transition-colors hover:border-dark hover:bg-dark hover:text-white"
        >
          <span className="translate-y-px">Connect X</span>
        </button>
      </div>
    </section>
  );
}
