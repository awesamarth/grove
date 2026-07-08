import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

function normalizeWallet(walletAddress: string) {
  return walletAddress.toLowerCase();
}

async function getProfileByWallet(ctx: QueryCtx, walletAddress: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", normalizeWallet(walletAddress)))
    .unique();
}

async function actorPreview(ctx: QueryCtx, profile: Doc<"profiles"> | null) {
  if (!profile || profile.privacy !== "public") return null;
  const avatarUrl = profile.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null;
  return {
    walletAddress: profile.walletAddress,
    username: profile.username,
    displayName: profile.displayName,
    xHandle: profile.xHandle ?? null,
    avatar: profile.avatar,
    avatarUrl: avatarUrl ?? profile.xProfileImageUrl ?? null,
  };
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

    return await Promise.all(notifications.map(async (notification) => {
      const actor = notification.actorWallet
        ? await actorPreview(ctx, await getProfileByWallet(ctx, notification.actorWallet))
        : null;
      return {
        ...notification,
        actor,
        href: actor ? `/profile/${actor.username}` : null,
      };
    }));
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

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in with MOSS first.");
    const walletAddress = normalizeWallet(identity.subject);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return;
    if (notification.walletAddress !== walletAddress) throw new Error("Not your notification.");
    await ctx.db.patch(notification._id, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in with MOSS first.");
    const walletAddress = normalizeWallet(identity.subject);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_walletAddress_and_read", (q) =>
        q.eq("walletAddress", walletAddress).eq("read", false),
      )
      .take(100);
    for (const notification of unread) {
      await ctx.db.patch(notification._id, { read: true });
    }
  },
});

export const deleteNotification = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in with MOSS first.");
    const walletAddress = normalizeWallet(identity.subject);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return;
    if (notification.walletAddress !== walletAddress) throw new Error("Not your notification.");
    await ctx.db.delete(notification._id);
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
