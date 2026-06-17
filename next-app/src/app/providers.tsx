"use client";

import type { Network } from "@megaeth-labs/wallet-sdk";
import { MegaProvider } from "@megaeth-labs/wallet-sdk-react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { XConnectProvider } from "../components/x-connect-modal";

const network: Network =
  process.env.NEXT_PUBLIC_MOSS_NETWORK === "mainnet" ? "mainnet" : "testnet";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConvexProvider client={convex}>
      <MegaProvider
        config={{
          network,
          logging: process.env.NODE_ENV === "development" ? "debug" : "warn",
        }}
      >
        <XConnectProvider>{children}</XConnectProvider>
      </MegaProvider>
    </ConvexProvider>
  );
}
