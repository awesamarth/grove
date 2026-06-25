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

export const initialise = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", profiles[0].walletAddress))
      .unique();

    if (existing) return { seeded: false };

    for (const profile of profiles) {
      await ctx.db.insert("profiles", {
        ...profile,
        handleKind: profile.xVerified ? "x" : "generated",
        onboardingComplete: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { seeded: true };
  },
});
