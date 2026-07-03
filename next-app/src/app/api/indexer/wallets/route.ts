import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";

const INDEXER_SECRET = process.env.INDEXER_SECRET;

function auth(request: Request) {
  return Boolean(INDEXER_SECRET && request.headers.get("authorization") === `Bearer ${INDEXER_SECRET}`);
}

export async function GET(request: Request) {
  if (!auth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  try {
    const wallets = await convex.query(api.dashboard.getOptedInWallets, { secret: INDEXER_SECRET! });
    return NextResponse.json(wallets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
