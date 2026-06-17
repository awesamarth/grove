import { NextRequest, NextResponse } from "next/server";

type VerifyResponse = {
  walletAddress?: string;
  address?: string;
  error?: string;
};

function verificationOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? new URL(request.url).host;
  return host;
}

export async function POST(request: NextRequest) {
  let body: { jwt?: unknown };

  try {
    body = (await request.json()) as { jwt?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.jwt !== "string" || body.jwt.length < 32) {
    return NextResponse.json({ error: "Missing MOSS JWT." }, { status: 400 });
  }

  const verifyUrl = new URL("https://wallet-api.megaeth.com/v1/partner-auth/verify");
  verifyUrl.searchParams.set("origin", verificationOrigin(request));
  verifyUrl.searchParams.set("jwt", body.jwt);

  const response = await fetch(verifyUrl, {
    method: "GET",
    cache: "no-store",
  });

  let result: VerifyResponse | null = null;
  try {
    result = (await response.json()) as VerifyResponse;
  } catch {
    result = null;
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: result?.error ?? "MOSS JWT verification failed." },
      { status: 401 },
    );
  }

  const walletAddress = result?.walletAddress ?? result?.address;
  if (!walletAddress) {
    return NextResponse.json(
      { error: "MOSS verification response did not include a wallet address." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    walletAddress: walletAddress.toLowerCase(),
  });
}
