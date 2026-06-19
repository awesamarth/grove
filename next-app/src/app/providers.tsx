"use client";

import type { Network } from "@megaeth-labs/wallet-sdk";
import { MegaProvider } from "@megaeth-labs/wallet-sdk-react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useCallback, useMemo } from "react";
import { XConnectProvider } from "../components/x-connect-modal";
import { useGroveSession } from "../lib/use-grove-session";

const network: Network =
  process.env.NEXT_PUBLIC_MOSS_NETWORK === "mainnet" ? "mainnet" : "testnet";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function useGroveConvexAuth() {
  const session = useGroveSession();
  const fetchAccessToken = useCallback(
    async () => session.token,
    [session.token],
  );

  return useMemo(
    () => ({
      isLoading: session.isLoading,
      isAuthenticated: session.authenticated,
      fetchAccessToken,
    }),
    [fetchAccessToken, session.authenticated, session.isLoading],
  );
}

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useGroveConvexAuth}>
      <MegaProvider
        config={{
          network,
          logging: process.env.NODE_ENV === "development" ? "debug" : "warn",
        }}
      >
        <XConnectProvider>{children}</XConnectProvider>
      </MegaProvider>
    </ConvexProviderWithAuth>
  );
}
