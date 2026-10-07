import { getMyBusiness } from "./lib/ownership";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

/** Store one chat message (internal — used by the chat action). */
export const insertMessage = internalMutation({
  args: {
    businessId: v.id("businesses"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("chatMessages", {
      businessId: args.businessId,
      role: args.role,
      content: args.content.slice(0, 4000),
      createdAt: Date.now(),
    });
  },
});

/**
 * Load recent chat history for a business (internal).
 */
export const recentMessages = internalQuery({
  args: {
    businessId: v.id("businesses"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_business", (q) =>
        q.eq("businessId", args.businessId),
      )
      .order("desc")
      .take(Math.min(Math.max(args.limit, 1), 100));
    return rows.reverse();
  },
});

/** Public: conversation history for the signed-in user's business. */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const business = await getMyBusiness(ctx);
    if (!business) return [];
    const n = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .order("desc")
      .take(n);
    return rows.reverse();
  },
});
