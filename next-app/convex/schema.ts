import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const privacy = v.union(v.literal("public"), v.literal("limited"), v.literal("private"));

export default defineSchema({
  profiles: defineTable({
    walletAddress: v.string(),
    username: v.string(),
    handleKind: v.optional(v.union(v.literal("generated"), v.literal("x"))),
    displayName: v.string(),
    xHandle: v.optional(v.string()),
    xUserId: v.optional(v.string()),
    xProfileImageUrl: v.optional(v.string()),
    xVerified: v.boolean(),
    bio: v.string(),
    avatar: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    onboardingComplete: v.optional(v.boolean()),
    privacy,
    activitySharing: privacy,
    karma: v.number(),
    upvotes: v.number(),
    downvotes: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_walletAddress", ["walletAddress"])
    .index("by_username", ["username"])
    .index("by_xHandle", ["xHandle"])
    .index("by_privacy_and_karma", ["privacy", "karma"])
    .searchIndex("search_displayName", {
      searchField: "displayName",
      filterFields: ["privacy"],
    }),

  follows: defineTable({
    followerWallet: v.string(),
    targetWallet: v.string(),
    createdAt: v.number(),
  })
    .index("by_followerWallet", ["followerWallet"])
    .index("by_targetWallet", ["targetWallet"])
    .index("by_followerWallet_and_targetWallet", ["followerWallet", "targetWallet"]),

  activities: defineTable({
    actorWallet: v.string(),
    kind: v.union(
      v.literal("game"),
      v.literal("tip"),
      v.literal("mint"),
      v.literal("app"),
      v.literal("karma"),
    ),
    appName: v.optional(v.string()),
    body: v.string(),
    detail: v.string(),
    visibility: privacy,
    tone: v.union(
      v.literal("success"),
      v.literal("primary"),
      v.literal("warning"),
      v.literal("dark"),
    ),
    reactions: v.number(),
    happenedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_visibility_and_happenedAt", ["visibility", "happenedAt"])
    .index("by_actorWallet_and_happenedAt", ["actorWallet", "happenedAt"]),

  activityLikes: defineTable({
    activityId: v.id("activities"),
    walletAddress: v.string(),
    createdAt: v.number(),
  })
    .index("by_activityId", ["activityId"])
    .index("by_walletAddress", ["walletAddress"])
    .index("by_activityId_and_walletAddress", ["activityId", "walletAddress"]),

  karmaVotes: defineTable({
    voterWallet: v.string(),
    targetWallet: v.string(),
    value: v.union(v.literal(1), v.literal(-1)),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_voterWallet_and_targetWallet", ["voterWallet", "targetWallet"])
    .index("by_targetWallet", ["targetWallet"]),

  tipIntents: defineTable({
    fromWallet: v.string(),
    toWallet: v.string(),
    amount: v.string(),
    token: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("paid"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    source: v.union(v.literal("web"), v.literal("extension"), v.literal("test")),
    txHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_fromWallet_and_createdAt", ["fromWallet", "createdAt"])
    .index("by_toWallet_and_createdAt", ["toWallet", "createdAt"]),

  notifications: defineTable({
    walletAddress: v.string(),
    kind: v.union(
      v.literal("tip_received"),
      v.literal("karma_vote"),
      v.literal("followed"),
    ),
    actorWallet: v.optional(v.string()),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_walletAddress_and_createdAt", ["walletAddress", "createdAt"])
    .index("by_walletAddress_and_read", ["walletAddress", "read"]),
});
