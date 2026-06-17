import crypto from "node:crypto";

export type XOAuthCookie = {
  state: string;
  verifier: string;
  walletAddress: string;
  redirectUri: string;
  expiresAt: number;
};

const stateCookieName = "grove_x_oauth";

export const xOAuth = {
  authUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.x.com/2/oauth2/token",
  meUrl: "https://api.x.com/2/users/me",
  scopes: ["tweet.read", "users.read"],
  stateCookieName,
};

export function xClientId() {
  return process.env.CLIENT_ID ?? process.env.X_CLIENT_ID;
}

export function xClientSecret() {
  return process.env.CLIENT_SECRET ?? process.env.X_CLIENT_SECRET;
}

function signingSecret() {
  return (
    process.env.X_OAUTH_STATE_SECRET ??
    process.env.CLIENT_SECRET ??
    process.env.X_CLIENT_SECRET ??
    process.env.CONVEX_DEPLOYMENT ??
    "grove-local-dev"
  );
}

function hmac(payload: string) {
  return crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function randomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

export function createPkcePair() {
  const verifier = randomToken(96);
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createOAuthCookie(data: XOAuthCookie) {
  const payload = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function readOAuthCookie(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || hmac(payload) !== signature) {
    throw new Error("Invalid X OAuth state.");
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as XOAuthCookie;
  if (Date.now() > data.expiresAt) {
    throw new Error("X OAuth state expired.");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) {
    throw new Error("Invalid Grove wallet in X OAuth state.");
  }

  return {
    ...data,
    walletAddress: data.walletAddress.toLowerCase(),
  };
}

export function appOriginFromRequest(request: Request) {
  const headers = request.headers;
  const forwardedProto = headers.get("x-forwarded-proto");
  const forwardedHost = headers.get("x-forwarded-host");
  const url = new URL(request.url);
  const proto = forwardedProto ?? url.protocol.replace(":", "");
  const host = forwardedHost ?? headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
