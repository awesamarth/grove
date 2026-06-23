import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { readGroveJwt } from "@/lib/moss-auth";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const session = readGroveJwt(token);

  if (!session) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  let body: {
    image?: string;
    imageType?: string;
    profit?: string;
    amount?: string;
    multiplier?: string;
    asset?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.image || !body.profit) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const binaryString = atob(body.image);
  const imageBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    imageBytes[i] = binaryString.charCodeAt(i);
  }
  const imageBuffer = imageBytes.buffer.slice(
    imageBytes.byteOffset,
    imageBytes.byteOffset + imageBytes.byteLength,
  );

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token!);

  try {
    await convex.action(api.euphoria.shareTrade, {
      imageBytes: imageBuffer,
      imageType: body.imageType ?? "image/png",
      profit: body.profit,
      amount: body.amount ?? "",
      multiplier: body.multiplier ?? "",
      asset: body.asset ?? "ETH",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Convex action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
