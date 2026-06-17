import { NextResponse } from "next/server";
import {
  appOriginFromRequest,
  createOAuthCookie,
  createPkcePair,
  randomToken,
  xClientId,
  xOAuth,
} from "@/lib/x-oauth";

export async function POST(request: Request) {
  let body: { walletAddress?: unknown };

  try {
    body = (await request.json()) as { walletAddress?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.walletAddress !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(body.walletAddress)) {
    return NextResponse.json({ error: "Connect MOSS before linking X." }, { status: 400 });
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
      walletAddress: body.walletAddress.toLowerCase(),
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
