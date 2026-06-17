import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

function normalizeWallet(walletAddress: string) {
  return walletAddress.toLowerCase();
}

async function getProfileByWallet(ctx: MutationCtx, walletAddress: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", normalizeWallet(walletAddress)))
    .unique();
}

export const setFollow = mutation({
  args: {
    devWalletAddress: v.string(),
    targetWallet: v.string(),
    following: v.boolean(),
  },
  handler: async (ctx, args) => {
    const followerWallet = normalizeWallet(args.devWalletAddress);
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
    }

    if (!args.following && existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const vote = mutation({
  args: {
    devWalletAddress: v.string(),
    targetWallet: v.string(),
    value: v.union(v.literal(1), v.literal(-1)),
  },
  handler: async (ctx, args) => {
    const voterWallet = normalizeWallet(args.devWalletAddress);
    const targetWallet = normalizeWallet(args.targetWallet);

    if (voterWallet === targetWallet) {
      throw new Error("You cannot vote on yourself.");
    }

    const voter = await getProfileByWallet(ctx, voterWallet);
    const target = await getProfileByWallet(ctx, targetWallet);
    if (!voter || !target) throw new Error("Both profiles must exist.");

    const existing = await ctx.db
      .query("reputationVotes")
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
      await ctx.db.insert("reputationVotes", {
        voterWallet,
        targetWallet,
        value: args.value,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (args.value === 1) upvotes += 1;
    if (args.value === -1) downvotes += 1;

    await ctx.db.patch(target._id, {
      upvotes,
      downvotes,
      reputation: Math.max(0, upvotes - downvotes),
      updatedAt: now,
    });
  },
});

export const createTipIntent = mutation({
  args: {
    devWalletAddress: v.string(),
    targetWallet: v.string(),
    amount: v.string(),
    token: v.string(),
    source: v.union(v.literal("web"), v.literal("extension"), v.literal("test")),
  },
  handler: async (ctx, args) => {
    const fromWallet = normalizeWallet(args.devWalletAddress);
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
