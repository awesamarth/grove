import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

function normalizeWallet(walletAddress: string) {
  return walletAddress.toLowerCase();
}

async function getProfileByWallet(ctx: MutationCtx, walletAddress: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", normalizeWallet(walletAddress)))
    .unique();
}

async function authenticatedWallet(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in with MOSS first.");
  return normalizeWallet(identity.subject);
}

export const setFollow = mutation({
  args: {
    targetWallet: v.string(),
    following: v.boolean(),
  },
  handler: async (ctx, args) => {
    const followerWallet = await authenticatedWallet(ctx);
    const targetWallet = normalizeWallet(args.targetWallet);

    if (followerWallet === targetWallet) {
      throw new Error("You cannot follow yourself.");
    }

    const follower = await getProfileByWallet(ctx, followerWallet);
    const target = await getProfileByWallet(ctx, targetWallet);
    if (!follower || !target) throw new Error("Both profiles must exist.");

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_followerWallet_and_targetWallet", (q) =>
        q.eq("followerWallet", followerWallet).eq("targetWallet", targetWallet),
      )
      .unique();

    if (args.following && !existing) {
      await ctx.db.insert("follows", {
        followerWallet,
        targetWallet,
        createdAt: Date.now(),
      });
      await ctx.runMutation(internal.notifications.insertNotification, {
        walletAddress: targetWallet,
        kind: "followed",
        actorWallet: followerWallet,
        body: `${follower.displayName} started following you.`,
      });
    }

    if (!args.following && existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const vote = mutation({
  args: {
    targetWallet: v.string(),
    value: v.union(v.literal(1), v.literal(-1)),
  },
  handler: async (ctx, args) => {
    const voterWallet = await authenticatedWallet(ctx);
    const targetWallet = normalizeWallet(args.targetWallet);

    if (voterWallet === targetWallet) {
      throw new Error("You cannot vote on yourself.");
    }

    const voter = await getProfileByWallet(ctx, voterWallet);
    const target = await getProfileByWallet(ctx, targetWallet);
    if (!voter || !target) throw new Error("Both profiles must exist.");

    const existing = await ctx.db
      .query("karmaVotes")
      .withIndex("by_voterWallet_and_targetWallet", (q) =>
        q.eq("voterWallet", voterWallet).eq("targetWallet", targetWallet),
      )
      .unique();

    const now = Date.now();
    let upvotes = target.upvotes;
    let downvotes = target.downvotes;

    if (existing) {
      if (existing.value === 1) upvotes -= 1;
      if (existing.value === -1) downvotes -= 1;
      await ctx.db.patch(existing._id, { value: args.value, updatedAt: now });
    } else {
      await ctx.db.insert("karmaVotes", {
        voterWallet,
        targetWallet,
        value: args.value,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.runMutation(internal.notifications.insertNotification, {
        walletAddress: targetWallet,
        kind: "karma_vote",
        actorWallet: voterWallet,
        body: `${voter.displayName} ${args.value === 1 ? "upvoted" : "downvoted"} your karma.`,
      });
    }

    if (args.value === 1) upvotes += 1;
    if (args.value === -1) downvotes += 1;

    await ctx.db.patch(target._id, {
      upvotes,
      downvotes,
      karma: Math.max(0, upvotes - downvotes),
      updatedAt: now,
    });
  },
});

export const toggleActivityLike = mutation({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, args) => {
    const walletAddress = await authenticatedWallet(ctx);
    const profile = await getProfileByWallet(ctx, walletAddress);
    if (!profile) throw new Error("Create a Grove profile first.");

    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found.");

    const existing = await ctx.db
      .query("activityLikes")
      .withIndex("by_activityId_and_walletAddress", (q) =>
        q.eq("activityId", args.activityId).eq("walletAddress", walletAddress),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { liked: false };
    }

    await ctx.db.insert("activityLikes", {
      activityId: args.activityId,
      walletAddress,
      createdAt: Date.now(),
    });
    return { liked: true };
  },
});

export const createTipIntent = mutation({
  args: {
    targetWallet: v.string(),
    amount: v.string(),
    token: v.string(),
    source: v.union(v.literal("web"), v.literal("extension"), v.literal("test")),
  },
  handler: async (ctx, args) => {
    const fromWallet = await authenticatedWallet(ctx);
    const toWallet = normalizeWallet(args.targetWallet);
    const from = await getProfileByWallet(ctx, fromWallet);
    const to = await getProfileByWallet(ctx, toWallet);
    if (!from || !to) throw new Error("Both profiles must exist.");

    const now = Date.now();
    return await ctx.db.insert("tipIntents", {
      fromWallet,
      toWallet,
      amount: args.amount,
      token: args.token,
      status: "draft",
      source: args.source,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTipIntentStatus = mutation({
  args: {
    intentId: v.id("tipIntents"),
    status: v.union(v.literal("paid"), v.literal("cancelled"), v.literal("failed")),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const walletAddress = await authenticatedWallet(ctx);
    const intent = await ctx.db.get(args.intentId);
    if (!intent) throw new Error("Tip intent not found.");
    if (intent.fromWallet !== walletAddress) {
      throw new Error("You can only update your own tip intents.");
    }

    await ctx.db.patch(args.intentId, {
      status: args.status,
      txHash: args.txHash,
      updatedAt: Date.now(),
    });

    if (args.status === "paid") {
      const sender = await getProfileByWallet(ctx, intent.fromWallet);
      if (sender) {
        await ctx.runMutation(internal.notifications.insertNotification, {
          walletAddress: intent.toWallet,
          kind: "tip_received",
          actorWallet: intent.fromWallet,
          body: `${sender.displayName} tipped you ${intent.amount} ${intent.token}.`,
        });
      }
    }
  },
});
