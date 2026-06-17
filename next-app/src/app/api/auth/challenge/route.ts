import { NextRequest, NextResponse } from "next/server";
import { getMessageToSign, type MessageConfig } from "@megaeth-labs/wallet-server-verify";
import { createChallengeToken } from "@/lib/moss-auth";

function requestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const url = new URL(request.url);
  const host = forwardedHost ?? request.headers.get("host") ?? url.host;
  const scheme = (forwardedProto ?? url.protocol.replace(":", "")) === "http" ? "http" : "https";

  return {
    scheme: scheme as "http" | "https",
    domain: host,
    uri: `${scheme}://${host}`,
  };
}

function chainId() {
  return process.env.NEXT_PUBLIC_MOSS_NETWORK === "mainnet" ? 4326 : 6343;
}

export async function POST(request: NextRequest) {
  let body: { address?: unknown };

  try {
    body = (await request.json()) as { address?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(body.address)) {
    return NextResponse.json({ error: "Missing or invalid wallet address." }, { status: 400 });
  }

  const origin = requestOrigin(request);
  const config: MessageConfig = {
    ...origin,
    chainId: chainId(),
    statement: "Sign in to Grove",
  };
  const challenge = getMessageToSign(config, body.address as `0x${string}`);

  return NextResponse.json({
    token: createChallengeToken(challenge, config),
    message: challenge.message,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt.toISOString(),
  });
}
