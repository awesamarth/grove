import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

function normalizeWallet(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export const insertNotification = internalMutation({
  args: {
    walletAddress: v.string(),
    kind: v.union(
      v.literal("tip_received"),
      v.literal("karma_vote"),
      v.literal("followed"),
    ),
    actorWallet: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      walletAddress: normalizeWallet(args.walletAddress),
      kind: args.kind,
      actorWallet: args.actorWallet ? normalizeWallet(args.actorWallet) : undefined,
      body: args.body,
      read: false,
      createdAt: Date.now(),
    });
  },
});

export const getNotifications = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const walletAddress = normalizeWallet(identity.subject);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_walletAddress_and_createdAt", (q) => q.eq("walletAddress", walletAddress))
      .order("desc")
      .take(20);
    return notifications;
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const walletAddress = normalizeWallet(identity.subject);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_walletAddress_and_read", (q) =>
        q.eq("walletAddress", walletAddress).eq("read", false),
      )
      .order("desc")
      .take(100);
    return unread.length;
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in with MOSS first.");
    const walletAddress = normalizeWallet(identity.subject);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_walletAddress_and_createdAt", (q) =>
        q.eq("walletAddress", walletAddress),
      )
      .collect();
    for (const notification of all) {
      await ctx.db.delete(notification._id);
    }
  },
});
