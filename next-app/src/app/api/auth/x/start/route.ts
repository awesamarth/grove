import { NextResponse } from "next/server";
import {
  appOriginFromRequest,
  createOAuthCookie,
  createPkcePair,
  randomToken,
  xClientId,
  xOAuth,
} from "@/lib/x-oauth";
import { groveSessionCookieName, readGroveSessionToken } from "@/lib/moss-auth";

export async function POST(request: Request) {
  const sessionCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${groveSessionCookieName}=`))
    ?.slice(groveSessionCookieName.length + 1);
  const session = readGroveSessionToken(sessionCookie ? decodeURIComponent(sessionCookie) : undefined);

  if (!session) {
    return NextResponse.json({ error: "Sign in with MOSS before linking X." }, { status: 401 });
  }

  const clientId = xClientId();
  if (!clientId) {
    return NextResponse.json({ error: "X OAuth is not configured." }, { status: 503 });
  }

  const origin = appOriginFromRequest(request);
  const redirectUri = `${origin}/api/auth/x/callback`;
  const state = randomToken(24);
  const { verifier, challenge } = createPkcePair();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: xOAuth.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.json({
    url: `${xOAuth.authUrl}?${params.toString()}`,
  });

  response.cookies.set({
    name: xOAuth.stateCookieName,
    value: createOAuthCookie({
      state,
      verifier,
      walletAddress: session.walletAddress,
      redirectUri,
      expiresAt: Date.now() + 10 * 60 * 1000,
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
