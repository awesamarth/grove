import { NextResponse } from "next/server";
import { Errors, verifySignature } from "@megaeth-labs/wallet-server-verify";
import { readChallengeToken } from "@/lib/moss-auth";

export async function POST(request: Request) {
  let body: { token?: unknown; signature?: unknown };

  try {
    body = (await request.json()) as { token?: unknown; signature?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.token !== "string" || typeof body.signature !== "string") {
    return NextResponse.json({ error: "Missing challenge token or signature." }, { status: 400 });
  }

  let challengeData: ReturnType<typeof readChallengeToken>;
  try {
    challengeData = readChallengeToken(body.token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_CHALLENGE";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    await verifySignature(challengeData.config, {
      ...challengeData.challenge,
      signature: body.signature as `0x${string}`,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    const safeCode =
      code === Errors.DIFFERENT_MESSAGE || code === Errors.INVALID_SIGNATURE
        ? code
        : "MOSS_SIGNATURE_VERIFICATION_FAILED";

    return NextResponse.json({ error: safeCode }, { status: 401 });
  }

  return NextResponse.json({
    walletAddress: challengeData.challenge.address.toLowerCase(),
  });
}
