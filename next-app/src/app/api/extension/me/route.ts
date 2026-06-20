import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { readGroveJwt } from "@/lib/moss-auth";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
  const session = readGroveJwt(token);

  if (!session) {
    return NextResponse.json({ error: "Invalid or expired Grove extension session." }, { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token!);
  const dashboard = await convex.query(api.dashboard.getDashboard, {});
  const notifications = await convex.query(api.notifications.getNotifications, {});

  return NextResponse.json({
    walletAddress: session.sub,
    viewer: dashboard.viewer,
    stats: dashboard.stats,
    feed: dashboard.feed.slice(0, 5),
    people: dashboard.people.slice(0, 5),
    notifications: notifications.slice(0, 8),
  });
}
