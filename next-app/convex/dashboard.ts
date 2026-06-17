import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const privacy = v.union(v.literal("public"), v.literal("limited"), v.literal("private"));

function normalizeWallet(walletAddress: string) {
  return walletAddress.toLowerCase();
}

function displayUsername(walletAddress: string) {
  const wallet = normalizeWallet(walletAddress);
  return `g_${wallet.slice(2, 8)}_${wallet.slice(-4)}`;
}

function oldDisplayUsername(walletAddress: string) {
  return `wallet_${normalizeWallet(walletAddress).slice(2, 8)}`;
}

function fullWalletUsername(walletAddress: string) {
  return `wallet_${normalizeWallet(walletAddress).slice(2)}`;
}

function isGeneratedWalletUsername(username: string, walletAddress: string) {
  return (
    username === oldDisplayUsername(walletAddress) ||
    username === fullWalletUsername(walletAddress) ||
    username === displayUsername(walletAddress)
  );
}

function profileIsComplete(profile: Doc<"profiles">) {
  if (profile.onboardingComplete !== undefined) return profile.onboardingComplete;
  if (profile.xVerified) return true;
  return profile.displayName.trim().length > 0 && profile.displayName !== "You";
}

function normalizeXHandle(xHandle: string) {
  const cleanHandle = xHandle.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(cleanHandle)) {
    throw new Error("Enter a valid X handle.");
  }
  return cleanHandle;
}

async function getProfileByWallet(ctx: QueryCtx | MutationCtx, walletAddress: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", normalizeWallet(walletAddress)))
    .unique();
}

async function linkXHandle(
  ctx: MutationCtx,
  args: { devWalletAddress: string; xHandle: string; xUserId?: string },
) {
  const profile = await getProfileByWallet(ctx, args.devWalletAddress);
  if (!profile) throw new Error("Create a Grove profile first.");

  const cleanHandle = normalizeXHandle(args.xHandle);

  const usernameOwner = await ctx.db
    .query("profiles")
    .withIndex("by_username", (q) => q.eq("username", cleanHandle))
    .unique();

  if (usernameOwner && usernameOwner.walletAddress !== profile.walletAddress) {
    throw new Error("That handle is already linked to another Grove profile.");
  }

  const xHandleOwner = await ctx.db
    .query("profiles")
    .withIndex("by_xHandle", (q) => q.eq("xHandle", cleanHandle))
    .unique();

  if (xHandleOwner && xHandleOwner.walletAddress !== profile.walletAddress) {
    throw new Error("That X account is already linked to another Grove profile.");
  }

  await ctx.db.patch(profile._id, {
    username: cleanHandle,
    handleKind: "x",
    xHandle: cleanHandle,
    xUserId: args.xUserId,
    xVerified: true,
    onboardingComplete: true,
    updatedAt: Date.now(),
  });

  return cleanHandle;
}

function timeAgo(happenedAt: number) {
  const minutes = Math.max(1, Math.round((Date.now() - happenedAt) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function isVisibleToViewer(activity: Doc<"activities">, actor: Doc<"profiles"> | null, viewerWallet?: string) {
  if (!actor || actor.privacy === "private" || actor.activitySharing === "private") return false;
  if (activity.visibility === "public" && actor.activitySharing === "public") return true;
  return Boolean(viewerWallet && actor.walletAddress === normalizeWallet(viewerWallet));
}

export const getDashboard = query({
  args: {
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewerWallet = args.viewerWallet ? normalizeWallet(args.viewerWallet) : undefined;
    const viewer = viewerWallet ? await getProfileByWallet(ctx, viewerWallet) : null;

    const publicProfiles = await ctx.db
      .query("profiles")
      .withIndex("by_privacy_and_reputation", (q) => q.eq("privacy", "public"))
      .order("desc")
      .take(12);

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_visibility_and_happenedAt", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(24);

    const actorWallets = new Set(activities.map((activity) => activity.actorWallet));
    const actors = new Map<string, Doc<"profiles">>();
    for (const wallet of actorWallets) {
      const profile = await getProfileByWallet(ctx, wallet);
      if (profile) actors.set(wallet, profile);
    }

    const follows = viewerWallet
      ? await ctx.db
          .query("follows")
          .withIndex("by_followerWallet", (q) => q.eq("followerWallet", viewerWallet))
          .take(100)
      : [];
    const followedWallets = new Set(follows.map((follow) => follow.targetWallet));

    const feed = activities
      .filter((activity) => isVisibleToViewer(activity, actors.get(activity.actorWallet) ?? null, viewerWallet))
      .slice(0, 8)
      .map((activity) => {
        const actor = actors.get(activity.actorWallet);
        return {
          ...activity,
          time: timeAgo(activity.happenedAt),
          actor: actor
            ? {
                walletAddress: actor.walletAddress,
                username: actor.username,
                displayName: actor.displayName,
                xHandle: actor.xHandle ?? null,
                xVerified: actor.xVerified,
                avatar: actor.avatar,
                reputation: actor.reputation,
              }
            : null,
        };
      });

    return {
      viewer: viewer
        ? {
            ...viewer,
            onboardingComplete: profileIsComplete(viewer),
            handleKind: viewer.handleKind ?? (viewer.xVerified ? "x" : "generated"),
          }
        : null,
      feed,
      people: publicProfiles
        .filter((profile) => profile.walletAddress !== viewerWallet)
        .slice(0, 5)
        .map((profile) => ({
          ...profile,
          onboardingComplete: profileIsComplete(profile),
          handleKind: profile.handleKind ?? (profile.xVerified ? "x" : "generated"),
          isFollowed: followedWallets.has(profile.walletAddress),
          mutuals: Math.max(2, Math.round(profile.reputation / 7)),
        })),
      stats: {
        people: publicProfiles.length,
        activities: activities.length,
        apps: 34,
      },
    };
  },
});

export const searchProfiles = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const queryText = args.query.trim().toLowerCase();
    if (queryText.length < 2) return [];

    const displayNameResults = await ctx.db
      .query("profiles")
      .withSearchIndex("search_displayName", (q) =>
        q.search("displayName", queryText).eq("privacy", "public"),
      )
      .take(6);

    const publicProfiles = await ctx.db
      .query("profiles")
      .withIndex("by_privacy_and_reputation", (q) => q.eq("privacy", "public"))
      .order("desc")
      .take(50);

    const results = new Map(
      displayNameResults.map((profile) => [profile.walletAddress, profile]),
    );

    for (const profile of publicProfiles) {
      if (results.size >= 6) break;
      const username = profile.username.toLowerCase();
      const xHandle = profile.xHandle?.toLowerCase() ?? "";
      const walletAddress = profile.walletAddress.toLowerCase();
      const walletWithoutPrefix = walletAddress.replace(/^0x/, "");
      const queryWithoutPrefix = queryText.replace(/^0x/, "");
      if (
        username.includes(queryText) ||
        xHandle.includes(queryText) ||
        walletAddress.includes(queryText) ||
        walletWithoutPrefix.includes(queryWithoutPrefix)
      ) {
        results.set(profile.walletAddress, profile);
      }
    }

    return Array.from(results.values()).map((profile) => ({
      walletAddress: profile.walletAddress,
      username: profile.username,
      handleKind: profile.handleKind ?? (profile.xVerified ? "x" : "generated"),
      displayName: profile.displayName,
      xHandle: profile.xHandle ?? null,
      avatar: profile.avatar,
      reputation: profile.reputation,
    }));
  },
});

export const getPublicProfileByXHandle = query({
  args: {
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanHandle = args.handle.replace(/^@/, "").trim().toLowerCase();
    if (!cleanHandle) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_xHandle", (q) => q.eq("xHandle", cleanHandle))
      .unique();

    if (!profile || profile.privacy !== "public" || !profile.xVerified) {
      return null;
    }

    const recentActivities =
      profile.activitySharing === "public"
        ? await ctx.db
            .query("activities")
            .withIndex("by_actorWallet_and_happenedAt", (q) =>
              q.eq("actorWallet", profile.walletAddress),
            )
            .order("desc")
            .take(3)
        : [];

    return {
      walletAddress: profile.walletAddress,
      username: profile.username,
      handleKind: profile.handleKind ?? (profile.xVerified ? "x" : "generated"),
      displayName: profile.displayName,
      xHandle: profile.xHandle ?? null,
      avatar: profile.avatar,
      reputation: profile.reputation,
      upvotes: profile.upvotes,
      downvotes: profile.downvotes,
      activitySharing: profile.activitySharing,
      recentActivities: recentActivities
        .filter((activity) => activity.visibility === "public")
        .map((activity) => ({
          kind: activity.kind,
          body: activity.body,
          detail: activity.detail,
          happenedAt: activity.happenedAt,
        })),
    };
  },
});

export const getProfileByUsername = query({
  args: {
    username: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanUsername = args.username.replace(/^@/, "").trim().toLowerCase();
    const viewerWallet = args.viewerWallet ? normalizeWallet(args.viewerWallet) : undefined;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .unique();

    if (!profile || profile.privacy === "private") {
      return null;
    }

    const recentActivities = await ctx.db
      .query("activities")
      .withIndex("by_actorWallet_and_happenedAt", (q) =>
        q.eq("actorWallet", profile.walletAddress),
      )
      .order("desc")
      .take(4);

    const follow = viewerWallet
      ? await ctx.db
          .query("follows")
          .withIndex("by_followerWallet_and_targetWallet", (q) =>
            q.eq("followerWallet", viewerWallet).eq("targetWallet", profile.walletAddress),
          )
          .unique()
      : null;

    const followers = await ctx.db
      .query("follows")
      .withIndex("by_targetWallet", (q) => q.eq("targetWallet", profile.walletAddress))
      .take(24);

    const followerProfiles = [];
    for (const follower of followers.slice(0, 5)) {
      const followerProfile = await getProfileByWallet(ctx, follower.followerWallet);
      if (followerProfile && followerProfile.privacy === "public") {
        followerProfiles.push({
          walletAddress: followerProfile.walletAddress,
          username: followerProfile.username,
          displayName: followerProfile.displayName,
          avatar: followerProfile.avatar,
        });
      }
    }

    return {
      profile: {
        ...profile,
        onboardingComplete: profileIsComplete(profile),
        handleKind: profile.handleKind ?? (profile.xVerified ? "x" : "generated"),
      },
      isFollowed: Boolean(follow),
      followerCount: followers.length,
      followersPreview: followerProfiles,
      recentActivities: recentActivities.filter(
        (activity) => activity.visibility === "public" && profile.activitySharing === "public",
      ),
    };
  },
});

export const upsertDevProfile = mutation({
  args: {
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWallet(args.walletAddress);
    const existing = await getProfileByWallet(ctx, walletAddress);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: now,
        username:
          isGeneratedWalletUsername(existing.username, walletAddress)
            ? displayUsername(walletAddress)
            : existing.username,
        handleKind: existing.handleKind ?? (existing.xVerified ? "x" : "generated"),
      });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      walletAddress,
      username: displayUsername(walletAddress),
      handleKind: "generated",
      displayName: args.displayName ?? "",
      xVerified: false,
      bio: "New Grove profile.",
      avatar: "niko",
      onboardingComplete: Boolean(args.displayName?.trim()),
      privacy: "public",
      activitySharing: "public",
      reputation: 50,
      upvotes: 50,
      downvotes: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const completeOnboarding = mutation({
  args: {
    walletAddress: v.string(),
    displayName: v.string(),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWallet(args.walletAddress);
    const displayName = args.displayName.trim().replace(/\s+/g, " ");

    if (displayName.length < 2) {
      throw new Error("Display name must be at least 2 characters.");
    }

    const existing = await getProfileByWallet(ctx, walletAddress);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        username: existing.xVerified ? existing.username : displayUsername(walletAddress),
        handleKind: existing.xVerified ? "x" : "generated",
        displayName,
        avatar: args.avatar ?? existing.avatar,
        onboardingComplete: true,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      walletAddress,
      username: displayUsername(walletAddress),
      handleKind: "generated",
      displayName,
      xVerified: false,
      bio: "New Grove profile.",
      avatar: args.avatar ?? "niko",
      onboardingComplete: true,
      privacy: "public",
      activitySharing: "public",
      reputation: 50,
      upvotes: 50,
      downvotes: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePrivacy = mutation({
  args: {
    devWalletAddress: v.string(),
    privacy,
    activitySharing: privacy,
  },
  handler: async (ctx, args) => {
    const profile = await getProfileByWallet(ctx, args.devWalletAddress);
    if (!profile) throw new Error("Create a Grove profile first.");

    await ctx.db.patch(profile._id, {
      privacy: args.privacy,
      activitySharing: args.activitySharing,
      updatedAt: Date.now(),
    });
  },
});

export const mockLinkX = mutation({
  args: {
    devWalletAddress: v.string(),
    xHandle: v.string(),
  },
  handler: async (ctx, args) => {
    await linkXHandle(ctx, args);
  },
});

export const linkVerifiedXByWallet = mutation({
  args: {
    walletAddress: v.string(),
    xHandle: v.string(),
    xUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await linkXHandle(ctx, {
      devWalletAddress: args.walletAddress,
      xHandle: args.xHandle,
      xUserId: args.xUserId,
    });
  },
});

export const clearMockXForWallet = mutation({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWallet(args.walletAddress);
    const profile = await getProfileByWallet(ctx, walletAddress);
    if (!profile) throw new Error("Profile not found.");

    await ctx.db.patch(profile._id, {
      username: displayUsername(walletAddress),
      handleKind: "generated",
      xHandle: undefined,
      xUserId: undefined,
      xVerified: false,
      updatedAt: Date.now(),
    });
  },
});
