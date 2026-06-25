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

function testToolsEnabled() {
  return process.env.GROVE_ENABLE_TEST_TOOLS === "true";
}

async function getProfileByWallet(ctx: QueryCtx | MutationCtx, walletAddress: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", normalizeWallet(walletAddress)))
    .unique();
}

async function authenticatedWallet(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in with MOSS first.");
  return normalizeWallet(identity.subject);
}

async function linkXHandle(
  ctx: MutationCtx,
  args: { walletAddress: string; xHandle: string; xUserId?: string; xProfileImageUrl?: string },
) {
  const profile = await getProfileByWallet(ctx, args.walletAddress);
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
    xProfileImageUrl: args.xProfileImageUrl,
    xVerified: true,
    onboardingComplete: true,
    updatedAt: Date.now(),
  });

  return cleanHandle;
}

async function avatarUrl(ctx: QueryCtx, profile: Doc<"profiles">) {
  if (profile.avatarStorageId) {
    const storedUrl = await ctx.storage.getUrl(profile.avatarStorageId);
    if (storedUrl) return storedUrl;
  }
  return profile.xProfileImageUrl ?? null;
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
    const identity = await ctx.auth.getUserIdentity();
    const viewerWallet = identity ? normalizeWallet(identity.subject) : undefined;
    const viewer = viewerWallet ? await getProfileByWallet(ctx, viewerWallet) : null;

    const publicProfiles = await ctx.db
      .query("profiles")
      .withIndex("by_privacy_and_karma", (q) => q.eq("privacy", "public"))
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

    const visibleActivities = activities
      .filter((activity) => isVisibleToViewer(activity, actors.get(activity.actorWallet) ?? null, viewerWallet))
      .slice(0, 8);

    const feed = [];
    for (const activity of visibleActivities) {
      const actor = actors.get(activity.actorWallet);
      const likes = await ctx.db
        .query("activityLikes")
        .withIndex("by_activityId", (q) => q.eq("activityId", activity._id))
        .collect();
      feed.push({
        ...activity,
        time: timeAgo(activity.happenedAt),
        reactions: activity.reactions + likes.length,
        likedByViewer: viewerWallet
          ? likes.some((like) => like.walletAddress === viewerWallet)
          : false,
        actor: actor
          ? {
              walletAddress: actor.walletAddress,
              username: actor.username,
              displayName: actor.displayName,
              xHandle: actor.xHandle ?? null,
              xVerified: actor.xVerified,
              avatar: actor.avatar,
              avatarUrl: await avatarUrl(ctx, actor),
              karma: actor.karma,
            }
          : null,
      });
    }

    return {
      viewer: viewer
        ? {
            ...viewer,
            avatarUrl: await avatarUrl(ctx, viewer),
            onboardingComplete: profileIsComplete(viewer),
            handleKind: viewer.handleKind ?? (viewer.xVerified ? "x" : "generated"),
          }
        : null,
      feed,
      people: await Promise.all(publicProfiles
        .filter((profile) => profile.walletAddress !== viewerWallet)
        .slice(0, 5)
        .map(async (profile) => ({
          ...profile,
          avatarUrl: await avatarUrl(ctx, profile),
          onboardingComplete: profileIsComplete(profile),
          handleKind: profile.handleKind ?? (profile.xVerified ? "x" : "generated"),
          isFollowed: followedWallets.has(profile.walletAddress),
          mutuals: Math.max(2, Math.round(profile.karma / 7)),
        }))),
      stats: {
        people: publicProfiles.length,
        activities: activities.length,
        apps: 9,
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
      .withIndex("by_privacy_and_karma", (q) => q.eq("privacy", "public"))
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

    return await Promise.all(Array.from(results.values()).map(async (profile) => ({
      walletAddress: profile.walletAddress,
      username: profile.username,
      handleKind: profile.handleKind ?? (profile.xVerified ? "x" : "generated"),
      displayName: profile.displayName,
      xHandle: profile.xHandle ?? null,
      avatar: profile.avatar,
      avatarUrl: await avatarUrl(ctx, profile),
      karma: profile.karma,
    })));
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
      avatarUrl: await avatarUrl(ctx, profile),
      karma: profile.karma,
      upvotes: profile.upvotes,
      downvotes: profile.downvotes,
      bio: profile.bio ?? null,
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
    const identity = await ctx.auth.getUserIdentity();
    const viewerWallet = identity ? normalizeWallet(identity.subject) : undefined;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .unique();

    if (!profile || profile.privacy === "private") {
      return null;
    }

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

    const recentActivities = await ctx.db
      .query("activities")
      .withIndex("by_actorWallet_and_happenedAt", (q) =>
        q.eq("actorWallet", profile.walletAddress),
      )
      .order("desc")
      .take(4);

    const followerProfiles = [];
    for (const follower of followers.slice(0, 5)) {
      const followerProfile = await getProfileByWallet(ctx, follower.followerWallet);
      if (followerProfile && followerProfile.privacy === "public") {
        followerProfiles.push({
          walletAddress: followerProfile.walletAddress,
          username: followerProfile.username,
          displayName: followerProfile.displayName,
          avatar: followerProfile.avatar,
          avatarUrl: await avatarUrl(ctx, followerProfile),
        });
      }
    }

    return {
      profile: {
        ...profile,
        avatarUrl: await avatarUrl(ctx, profile),
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

export const getProfileActivities = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanUsername = args.username.replace(/^@/, "").trim().toLowerCase();
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .unique();

    if (!profile || profile.privacy === "private" || profile.activitySharing !== "public") {
      return { profile: null, activities: [] };
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_actorWallet_and_happenedAt", (q) =>
        q.eq("actorWallet", profile.walletAddress),
      )
      .order("desc")
      .take(30);

    const visibleActivities = activities.filter((a) => a.visibility === "public");

    return {
      profile: {
        walletAddress: profile.walletAddress,
        username: profile.username,
        displayName: profile.displayName,
        avatar: profile.avatar,
        avatarUrl: await avatarUrl(ctx, profile),
      },
      activities: visibleActivities,
    };
  },
});

export const upsertDevProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const walletAddress = await authenticatedWallet(ctx);
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
      karma: 50,
      upvotes: 50,
      downvotes: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const completeOnboarding = mutation({
  args: {
    displayName: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const walletAddress = await authenticatedWallet(ctx);
    const displayName = args.displayName.trim().replace(/\s+/g, " ");

    if (displayName.length < 2) {
      throw new Error("Display name must be at least 2 characters.");
    }

    const existing = await getProfileByWallet(ctx, walletAddress);
    const now = Date.now();
    const bio = args.bio?.trim().replace(/\s+/g, " ") ?? existing?.bio ?? "New Grove profile.";

    if (existing) {
      await ctx.db.patch(existing._id, {
        username: existing.xVerified ? existing.username : displayUsername(walletAddress),
        handleKind: existing.xVerified ? "x" : "generated",
        displayName,
        bio,
        avatar: args.avatar ?? existing.avatar,
        avatarStorageId: args.avatarStorageId ?? existing.avatarStorageId,
        xProfileImageUrl: args.avatarStorageId ? undefined : existing.xProfileImageUrl,
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
      bio,
      avatar: args.avatar ?? "niko",
      avatarStorageId: args.avatarStorageId,
      onboardingComplete: true,
      privacy: "public",
      activitySharing: "public",
      karma: 50,
      upvotes: 50,
      downvotes: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const generateProfileAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await authenticatedWallet(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    const walletAddress = await authenticatedWallet(ctx);
    const profile = await getProfileByWallet(ctx, walletAddress);
    if (!profile) throw new Error("Create a Grove profile first.");

    const displayName = args.displayName.trim().replace(/\s+/g, " ");
    if (displayName.length < 2) {
      throw new Error("Display name must be at least 2 characters.");
    }
    const bio = args.bio?.trim().replace(/\s+/g, " ") ?? profile.bio;

    await ctx.db.patch(profile._id, {
      displayName,
      bio,
      avatar: args.avatar ?? profile.avatar,
      avatarStorageId: args.avatarStorageId === null ? undefined : (args.avatarStorageId ?? profile.avatarStorageId),
      xProfileImageUrl: args.avatarStorageId === null ? undefined : profile.xProfileImageUrl,
      updatedAt: Date.now(),
    });
  },
});

export const updatePrivacy = mutation({
  args: {
    privacy,
    activitySharing: privacy,
  },
  handler: async (ctx, args) => {
    const walletAddress = await authenticatedWallet(ctx);
    const profile = await getProfileByWallet(ctx, walletAddress);
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
    xHandle: v.string(),
  },
  handler: async (ctx, args) => {
    if (!testToolsEnabled()) {
      throw new Error("Mock X linking is disabled in production.");
    }
    const walletAddress = await authenticatedWallet(ctx);
    await linkXHandle(ctx, { walletAddress, xHandle: args.xHandle });
  },
});

export const linkVerifiedX = mutation({
  args: {
    xHandle: v.string(),
    xUserId: v.string(),
    xProfileImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const walletAddress = await authenticatedWallet(ctx);
    return await linkXHandle(ctx, {
      walletAddress,
      xHandle: args.xHandle,
      xUserId: args.xUserId,
      xProfileImageUrl: args.xProfileImageUrl,
    });
  },
});

export const clearMockXForWallet = mutation({
  args: {},
  handler: async (ctx, args) => {
    const walletAddress = await authenticatedWallet(ctx);
    const profile = await getProfileByWallet(ctx, walletAddress);
    if (!profile) throw new Error("Profile not found.");

    await ctx.db.patch(profile._id, {
      username: displayUsername(walletAddress),
      handleKind: "generated",
      xHandle: undefined,
      xUserId: undefined,
      xProfileImageUrl: undefined,
      xVerified: false,
      updatedAt: Date.now(),
    });
  },
});

export const wipeWalletForTesting = mutation({
  args: {},
  handler: async (ctx, args) => {
    if (!testToolsEnabled()) {
      throw new Error("Test wallet wiping is disabled in production.");
    }
    const walletAddress = await authenticatedWallet(ctx);
    const profile = await getProfileByWallet(ctx, walletAddress);

    const follows = [
      ...(await ctx.db
        .query("follows")
        .withIndex("by_followerWallet", (q) => q.eq("followerWallet", walletAddress))
        .collect()),
      ...(await ctx.db
        .query("follows")
        .withIndex("by_targetWallet", (q) => q.eq("targetWallet", walletAddress))
        .collect()),
    ];
    for (const follow of follows) {
      await ctx.db.delete(follow._id);
    }

    const votes = [
      ...(await ctx.db
        .query("karmaVotes")
        .withIndex("by_targetWallet", (q) => q.eq("targetWallet", walletAddress))
        .collect()),
      ...(await ctx.db.query("karmaVotes").collect()).filter(
        (vote) => vote.voterWallet === walletAddress,
      ),
    ];
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_actorWallet_and_happenedAt", (q) => q.eq("actorWallet", walletAddress))
      .collect();
    for (const activity of activities) {
      await ctx.db.delete(activity._id);
    }

    const tipIntents = (await ctx.db.query("tipIntents").collect()).filter(
      (intent) => intent.fromWallet === walletAddress || intent.toWallet === walletAddress,
    );
    for (const tipIntent of tipIntents) {
      await ctx.db.delete(tipIntent._id);
    }

    const activityLikes = (await ctx.db.query("activityLikes").collect()).filter(
      (like) =>
        like.walletAddress === walletAddress ||
        activities.some((activity) => activity._id === like.activityId),
    );
    for (const like of activityLikes) {
      await ctx.db.delete(like._id);
    }

    if (profile) {
      await ctx.db.delete(profile._id);
    }

    return {
      deletedProfile: Boolean(profile),
      deletedFollows: follows.length,
      deletedVotes: votes.length,
      deletedActivities: activities.length,
      deletedTipIntents: tipIntents.length,
      deletedActivityLikes: activityLikes.length,
    };
  },
});

export const getOptedInWallets = query({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    return profiles
      .filter((p) => p.privacy === "public" || p.activitySharing === "public")
      .map((p) => ({ walletAddress: p.walletAddress }));
  },
});

export const clearSeededActivities = mutation({
  args: {},
  handler: async (ctx) => {
    const bodies = [
      "hit a 50x leverage slot spin on Hit.One",
      "tipped Juno for shipping a new community tool",
      "opened a tap-to-trade position on Euphoria",
      "deposited into Cap for insured yield",
    ];
    const activities = await ctx.db.query("activities").collect();
    let count = 0;
    for (const a of activities) {
      if (bodies.includes(a.body)) {
        await ctx.db.delete(a._id);
        count++;
      }
    }
    return { deleted: count };
  },
});

export const insertIndexedActivity = mutation({
  args: {
    walletAddress: v.string(),
    appName: v.string(),
    txHash: v.string(),
    blockNumber: v.number(),
    body: v.string(),
    tone: v.string(),
  },
  handler: async (ctx, args) => {
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    const recent = await ctx.db
      .query("activities")
      .withIndex("by_actorWallet_and_happenedAt", (q) =>
        q.eq("actorWallet", args.walletAddress).gte("happenedAt", thirtyMinAgo)
      )
      .first();
    if (recent) return;

    await ctx.db.insert("activities", {
      actorWallet: args.walletAddress,
      kind: "app",
      appName: args.appName,
      body: args.body,
      detail: "",
      visibility: "public",
      tone: args.tone as "success" | "primary",
      reactions: 0,
      happenedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const deleteActivity = mutation({
  args: { activityId: v.id("activities") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");

    const wallet = normalizeWallet(identity.subject);
    if (activity.actorWallet !== wallet) throw new Error("Not the activity owner");

    await ctx.db.delete(args.activityId);
  },
});
