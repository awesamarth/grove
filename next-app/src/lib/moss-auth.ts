import crypto from "node:crypto";
import type { MessageConfig, MessageToSign } from "@megaeth-labs/wallet-server-verify";

const challengeTtlMs = 5 * 60 * 1000;
const sessionTtlMs = 30 * 24 * 60 * 60 * 1000;
const groveJwtTtlSeconds = 60 * 60;
export const groveSessionCookieName = "grove_session";

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

type GroveSessionPayload = {
  walletAddress: string;
  issuedAt: number;
  expiresAt: number;
};

type GroveJwtPayload = {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  wallet_address: string;
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

export function createGroveSessionToken(walletAddress: string) {
  const payload: GroveSessionPayload = {
    walletAddress: walletAddress.toLowerCase(),
    issuedAt: Date.now(),
    expiresAt: Date.now() + sessionTtlMs,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${signPayload(encoded)}`;
}

export function readGroveSessionToken(token?: string) {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || signature !== signPayload(encoded)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GroveSessionPayload;
  if (Date.now() > payload.expiresAt || !/^0x[a-f0-9]{40}$/.test(payload.walletAddress)) {
    return null;
  }

  return payload;
}

export function groveSessionMaxAgeSeconds() {
  return Math.floor(sessionTtlMs / 1000);
}

function groveJwtPrivateKey() {
  const encoded = process.env.GROVE_JWT_PRIVATE_KEY_B64;
  if (!encoded) {
    throw new Error("GROVE_JWT_PRIVATE_KEY_B64 is not configured.");
  }
  return Buffer.from(encoded, "base64").toString("utf8");
}

export function groveJwtIssuer() {
  return process.env.GROVE_AUTH_ISSUER ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
}

export function groveJwtAudience() {
  return process.env.GROVE_AUTH_AUDIENCE ?? "grove";
}

function groveJwtKid() {
  return process.env.GROVE_JWT_KID ?? "grove-dev-key";
}

export function createGroveJwt(walletAddress: string) {
  const issuer = groveJwtIssuer();
  if (!issuer) {
    throw new Error("GROVE_AUTH_ISSUER or NEXT_PUBLIC_CONVEX_SITE_URL is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
      kid: groveJwtKid(),
    }),
  );
  const payload = base64url(
    JSON.stringify({
      iss: issuer,
      sub: walletAddress.toLowerCase(),
      aud: groveJwtAudience(),
      iat: now,
      exp: now + groveJwtTtlSeconds,
      wallet_address: walletAddress.toLowerCase(),
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .sign(groveJwtPrivateKey(), "base64url");

  return `${signingInput}.${signature}`;
}

export function readGroveJwt(token?: string) {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== "RS256" || header.typ !== "JWT") return null;

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const valid = crypto
      .createVerify("RSA-SHA256")
      .update(signingInput)
      .verify(crypto.createPublicKey(groveJwtPrivateKey()), signature, "base64url");

    if (!valid) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as GroveJwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iss !== groveJwtIssuer()) return null;
    if (payload.aud !== groveJwtAudience()) return null;
    if (!/^0x[a-f0-9]{40}$/.test(payload.sub)) return null;
    if (payload.wallet_address !== payload.sub) return null;

    return payload;
  } catch {
    return null;
  }
}
