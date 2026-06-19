import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { createGroveJwt } from "@/lib/moss-auth";
import { readOAuthCookie, xClientId, xClientSecret, xOAuth } from "@/lib/x-oauth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type XTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type XMeResponse = {
  data?: {
    id?: string;
    username?: string;
    name?: string;
    profile_image_url?: string;
  };
  errors?: Array<{ detail?: string; message?: string }>;
};

function redirectHome(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const storedState = request.cookies.get(xOAuth.stateCookieName)?.value;

  if (providerError) {
    const response = redirectHome(request, { x_error: providerError });
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  }

  if (!code || !state || !storedState) {
    const response = redirectHome(request, { x_error: "missing_oauth_state" });
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  }

  let oauthState: ReturnType<typeof readOAuthCookie>;
  try {
    oauthState = readOAuthCookie(storedState);
  } catch (error) {
    const response = redirectHome(request, {
      x_error: error instanceof Error ? error.message : "invalid_oauth_state",
    });
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  }

  if (oauthState.state !== state) {
    const response = redirectHome(request, { x_error: "state_mismatch" });
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  }

  const clientId = xClientId();
  const clientSecret = xClientSecret();
  if (!clientId) {
    const response = redirectHome(request, { x_error: "missing_x_client_id" });
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  }

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: oauthState.redirectUri,
    code_verifier: oauthState.verifier,
  });

  const tokenHeaders: HeadersInit = {
    "content-type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    tokenHeaders.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    tokenParams.set("client_id", clientId);
  }

  const tokenResponse = await fetch(xOAuth.tokenUrl, {
    method: "POST",
    headers: tokenHeaders,
    body: tokenParams.toString(),
    cache: "no-store",
  });
  const tokens = (await tokenResponse.json()) as XTokenResponse;

  if (!tokenResponse.ok || !tokens.access_token) {
    const response = redirectHome(request, {
      x_error: tokens.error_description ?? tokens.error ?? "token_exchange_failed",
    });
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  }

  const meUrl = new URL(xOAuth.meUrl);
  meUrl.searchParams.set("user.fields", "profile_image_url");

  const meResponse = await fetch(meUrl, {
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
    },
    cache: "no-store",
  });
  const me = (await meResponse.json()) as XMeResponse;
  const xUserId = me.data?.id;
  const xHandle = me.data?.username;
  const xProfileImageUrl = me.data?.profile_image_url?.replace("_normal.", "_400x400.");

  if (!meResponse.ok || !xUserId || !xHandle) {
    const message = me.errors?.[0]?.detail ?? me.errors?.[0]?.message ?? "x_profile_lookup_failed";
    const response = redirectHome(request, { x_error: message });
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  }

  try {
    convex.setAuth(createGroveJwt(oauthState.walletAddress));
    const username = await convex.mutation(api.dashboard.linkVerifiedX, {
      xHandle,
      xUserId,
      xProfileImageUrl,
    });
    const profileUrl = new URL(`/profile/${username}`, request.url);
    profileUrl.searchParams.set("x", "connected");
    const response = NextResponse.redirect(profileUrl);
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  } catch (error) {
    const response = redirectHome(request, {
      x_error: error instanceof Error ? error.message : "could_not_link_x",
    });
    response.cookies.delete(xOAuth.stateCookieName);
    return response;
  }
}
