import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

function normalizeWallet(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export const insertActivity = internalMutation({
  args: {
    walletAddress: v.string(),
    imageUrl: v.string(),
    profit: v.string(),
    amount: v.string(),
    multiplier: v.string(),
    asset: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activities", {
      actorWallet: args.walletAddress,
      kind: "app",
      appName: "Euphoria",
      body: `Just won on Euphoria! ${args.profit} on ${args.asset}`,
      detail: JSON.stringify({
        profit: args.profit,
        amount: args.amount,
        multiplier: args.multiplier,
        asset: args.asset,
        imageUrl: args.imageUrl,
      }),
      visibility: "public",
      tone: "success",
      reactions: 0,
      happenedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const shareTrade = action({
  args: {
    imageBytes: v.bytes(),
    imageType: v.string(),
    profit: v.string(),
    amount: v.string(),
    multiplier: v.string(),
    asset: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const walletAddress = normalizeWallet(identity.subject);

    const storageId = await ctx.storage.store(
      new Blob([args.imageBytes], { type: args.imageType }),
    );
    const imageUrl = (await ctx.storage.getUrl(storageId))!;

    await ctx.runMutation(internal.euphoria.insertActivity, {
      walletAddress,
      imageUrl,
      profit: args.profit,
      amount: args.amount,
      multiplier: args.multiplier,
      asset: args.asset,
    });
  },
});
