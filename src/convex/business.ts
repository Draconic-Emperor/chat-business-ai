import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getMyBusiness } from "./lib/ownership";

/** Get the signed-in user's business. */
export const getMyBusinessQuery = query({
  args: {},
  handler: async (ctx) => {
    const business = await getMyBusiness(ctx);
    if (business === null) return null;
    const user = business.ownerId
      ? ((await ctx.db.get(business.ownerId)) ?? null)
      : null;
    return { ...business, ownerEmail: user?.email ?? null };
  },
});

/** Check whether the signed-in user already has a business. */
export const hasBusiness = query({
  args: {},
  handler: async (ctx) => {
    const business = await getMyBusiness(ctx);
    return business !== null;
  },
});

/** Create the business for the current user (one per user, enforced). */
export const createBusiness = mutation({
  args: {
    businessName: v.string(),
    businessType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await getMyBusiness(ctx);
    if (existing) return existing._id;
    const now = Date.now();
    return ctx.db.insert("businesses", {
      ownerId: userId,
      businessName: args.businessName.trim().slice(0, 120),
      businessType: args.businessType.trim().slice(0, 40) || "General shop",
      createdAt: now,
    });
  },
});

/** Internal variant for actions (which have no ctx.db). */
export const myBusinessInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const business = await getMyBusiness(ctx);
    return business;
  },
});

/** Update business name/type. */
export const updateBusiness = mutation({
  args: {
    businessName: v.string(),
    businessType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const business = await getMyBusiness(ctx);
    if (business === null) throw new Error("Create your shop first");
    await ctx.db.patch(business._id, {
      businessName: args.businessName.trim().slice(0, 120),
      businessType: args.businessType.trim().slice(0, 40),
    });
  },
});
