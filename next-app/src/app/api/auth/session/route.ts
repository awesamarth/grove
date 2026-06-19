import { NextRequest, NextResponse } from "next/server";
import { createGroveJwt, groveSessionCookieName, readGroveSessionToken } from "@/lib/moss-auth";

export async function GET(request: NextRequest) {
  const session = readGroveSessionToken(request.cookies.get(groveSessionCookieName)?.value);

  return NextResponse.json({
    authenticated: Boolean(session),
    walletAddress: session?.walletAddress ?? null,
    token: session ? createGroveJwt(session.walletAddress) : null,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false, walletAddress: null });
  response.cookies.delete(groveSessionCookieName);
  return response;
}
