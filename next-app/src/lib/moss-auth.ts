import crypto from "node:crypto";
import type { MessageConfig, MessageToSign } from "@megaeth-labs/wallet-server-verify";

const challengeTtlMs = 5 * 60 * 1000;

type ChallengePayload = {
  address: `0x${string}`;
  message: string;
  nonce: string;
  issuedAt: string;
  expiresAt: number;
  scheme: "http" | "https";
  domain: string;
  uri: string;
  chainId: 4326 | 6343;
};

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signingSecret() {
  return (
    process.env.MOSS_AUTH_CHALLENGE_SECRET ??
    process.env.CONVEX_DEPLOYMENT ??
    "grove-local-development-only"
  );
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createChallengeToken(challenge: MessageToSign, config: MessageConfig) {
  const payload: ChallengePayload = {
    address: challenge.address,
    message: challenge.message,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt.toISOString(),
    expiresAt: Date.now() + challengeTtlMs,
    scheme: config.scheme,
    domain: config.domain,
    uri: config.uri,
    chainId: config.chainId,
  };

  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${signPayload(encoded)}`;
}

export function readChallengeToken(token: string) {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature || signature !== signPayload(encoded)) {
    throw new Error("INVALID_CHALLENGE");
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ChallengePayload;

  if (Date.now() > payload.expiresAt) {
    throw new Error("EXPIRED_CHALLENGE");
  }

  const config: MessageConfig = {
    scheme: payload.scheme,
    domain: payload.domain,
    uri: payload.uri,
    chainId: payload.chainId,
    statement: "Sign in to Grove",
  };

  return {
    config,
    challenge: {
      address: payload.address,
      message: payload.message,
      nonce: payload.nonce,
      issuedAt: new Date(payload.issuedAt),
    },
  };
}
