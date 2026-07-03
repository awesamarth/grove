import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";

const INDEXER_SECRET = process.env.INDEXER_SECRET;

function auth(request: Request) {
  return Boolean(INDEXER_SECRET && request.headers.get("authorization") === `Bearer ${INDEXER_SECRET}`);
}

export async function POST(request: Request) {
  if (!auth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    walletAddress?: string;
    txHash?: string;
    appName?: string;
    body?: string;
    tone?: string;
    blockNumber?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.walletAddress || !body.txHash || !body.appName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  try {
    await convex.mutation(api.dashboard.insertIndexedActivity, {
      secret: INDEXER_SECRET!,
      walletAddress: body.walletAddress,
      appName: body.appName,
      txHash: body.txHash,
      blockNumber: body.blockNumber ?? 0,
      body: body.body ?? `Interacted with ${body.appName}`,
      tone: body.tone ?? "primary",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Insert failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
