import { mutation } from "./_generated/server";

const profiles = [
  {
    walletAddress: "0x1111111111111111111111111111111111111111",
    username: "mira",
    displayName: "Mira",
    xHandle: "miramakes",
    xVerified: true,
    bio: "Ships tiny games and noisy experiments.",
    avatar: "mira",
    privacy: "public" as const,
    activitySharing: "public" as const,
    karma: 81,
    upvotes: 97,
    downvotes: 16,
  },
  {
    walletAddress: "0x2222222222222222222222222222222222222222",
    username: "raihan",
    displayName: "Raihan",
    xHandle: "rxhn",
    xVerified: true,
    bio: "Tooling, testnet markets, community ops.",
    avatar: "raihan",
    privacy: "public" as const,
    activitySharing: "public" as const,
    karma: 88,
    upvotes: 121,
    downvotes: 33,
  },
  {
    walletAddress: "0x3333333333333333333333333333333333333333",
    username: "juno",
    displayName: "Juno",
    xHandle: "juno_builds",
    xVerified: true,
    bio: "Makes dashboards feel less dead.",
    avatar: "juno",
    privacy: "public" as const,
    activitySharing: "public" as const,
    karma: 76,
    upvotes: 84,
    downvotes: 8,
  },
  {
    walletAddress: "0x4444444444444444444444444444444444444444",
    username: "kai",
    displayName: "Kai",
    xHandle: "kaiworld",
    xVerified: false,
    bio: "Onchain games, weird leaderboards.",
    avatar: "kai",
    privacy: "public" as const,
    activitySharing: "public" as const,
    karma: 69,
    upvotes: 72,
    downvotes: 3,
  },
  {
    walletAddress: "0x5555555555555555555555555555555555555555",
    username: "alba",
    displayName: "Alba",
    xHandle: "alba",
    xVerified: true,
    bio: "Finds the good stuff early.",
    avatar: "alba",
    privacy: "public" as const,
    activitySharing: "limited" as const,
    karma: 92,
    upvotes: 130,
    downvotes: 38,
  },
  {
    walletAddress: "0x6666666666666666666666666666666666666666",
    username: "niko",
    displayName: "Niko",
    xHandle: "nikos",
    xVerified: false,
    bio: "Collector, grinder, reply guy in recovery.",
    avatar: "niko",
    privacy: "public" as const,
    activitySharing: "public" as const,
    karma: 87,
    upvotes: 103,
    downvotes: 16,
  },
];

const activities = [
  {
    actorWallet: profiles[0].walletAddress,
    kind: "game" as const,
    appName: "Hit.One",
    body: "hit a 50x leverage slot spin on Hit.One",
    detail: "0.05 ETH · testnet",
    visibility: "public" as const,
    tone: "success" as const,
    reactions: 18,
    offsetMs: 2 * 60 * 1000,
  },
  {
    actorWallet: profiles[1].walletAddress,
    kind: "tip" as const,
    appName: "Grove",
    body: "tipped Juno for shipping a new community tool",
    detail: "8.00 USDM",
    visibility: "public" as const,
    tone: "primary" as const,
    reactions: 31,
    offsetMs: 11 * 60 * 1000,
  },
  {
    actorWallet: profiles[2].walletAddress,
    kind: "mint" as const,
    appName: "Euphoria",
    body: "opened a tap-to-trade position on Euphoria",
    detail: "first trade · testnet",
    visibility: "public" as const,
    tone: "warning" as const,
    reactions: 9,
    offsetMs: 28 * 60 * 1000,
  },
  {
    actorWallet: profiles[3].walletAddress,
    kind: "app" as const,
    appName: "Cap",
    body: "deposited into Cap for insured yield",
    detail: "100 USDM · principal protected",
    visibility: "public" as const,
    tone: "dark" as const,
    reactions: 6,
    offsetMs: 44 * 60 * 1000,
  },
];

export const initialise = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", profiles[0].walletAddress))
      .unique();

    if (existing) {
      for (const activity of activities) {
        const happenedAt = now - activity.offsetMs;
        const matching = await ctx.db
          .query("activities")
          .withIndex("by_actorWallet_and_happenedAt", (q) =>
            q.eq("actorWallet", activity.actorWallet),
          )
          .take(10);
        const current = matching.find((item) => item.kind === activity.kind);

        if (current) {
          await ctx.db.patch(current._id, {
            body: activity.body,
            detail: activity.detail,
            reactions: activity.reactions,
            happenedAt,
          });
        }
      }
      return { seeded: false };
    }

    for (const profile of profiles) {
      await ctx.db.insert("profiles", {
        ...profile,
        handleKind: profile.xVerified ? "x" : "generated",
        onboardingComplete: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const activity of activities) {
      const happenedAt = now - activity.offsetMs;
      await ctx.db.insert("activities", {
        actorWallet: activity.actorWallet,
        kind: activity.kind,
        appName: activity.appName,
        body: activity.body,
        detail: activity.detail,
        visibility: activity.visibility,
        tone: activity.tone,
        reactions: activity.reactions,
        happenedAt,
        createdAt: happenedAt,
      });
    }

    return { seeded: true };
  },
});
