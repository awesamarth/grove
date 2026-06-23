import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "public, max-age=30, stale-while-revalidate=60",
};

type RouteContext = {
  params: Promise<{ handle: string }>;
};

function appOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? new URL(request.url).host;
  return `${forwardedProto}://${host}`;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { handle } = await context.params;
  const cleanHandle = decodeURIComponent(handle).replace(/^@/, "").trim().toLowerCase();

  if (!cleanHandle) {
    return NextResponse.json(
      { linked: false, error: "Missing X handle." },
      { status: 400, headers: corsHeaders },
    );
  }

  const profile = await convex.query(api.dashboard.getPublicProfileByXHandle, {
    handle: cleanHandle,
  });

  if (!profile) {
    return NextResponse.json(
      { linked: false, handle: cleanHandle },
      { status: 404, headers: corsHeaders },
    );
  }

  const origin = appOrigin(request);

  return NextResponse.json(
    {
      linked: true,
      handle: cleanHandle,
      profile: {
        username: profile.username,
        displayName: profile.displayName,
        xHandle: profile.xHandle,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl ?? `${origin}/avatars/${profile.avatar}.png`,
        karma: profile.karma,
        upvotes: profile.upvotes,
        downvotes: profile.downvotes,
        walletAddress: profile.walletAddress,
        profileUrl: `${origin}/profile/${profile.username}`,
        tipUrl: `${origin}/tip/${profile.username}`,
      },
      activity: {
        sharing: profile.activitySharing,
        recent: profile.recentActivities,
      },
    },
    { headers: corsHeaders },
  );
}
