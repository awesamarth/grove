"use client";

import type { Network } from "@megaeth-labs/wallet-sdk";
import { MegaProvider } from "@megaeth-labs/wallet-sdk-react";

const network: Network =
  process.env.NEXT_PUBLIC_MOSS_NETWORK === "mainnet" ? "mainnet" : "testnet";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <MegaProvider
      config={{
        network,
        logging: process.env.NODE_ENV === "development" ? "debug" : "warn",
      }}
    >
      {children}
    </MegaProvider>
  );
}
