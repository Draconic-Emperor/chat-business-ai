import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/** The signed-in user's business, or null if none exists yet. */
export async function getMyBusiness(
  ctx: Ctx,
): Promise<Doc<"businesses"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return ctx.db
    .query("businesses")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .first();
}

/**
 * Throws unless `businessId` exists and belongs to the signed-in user.
 * Every data query/mutation must call this so users only ever see their
 * own business data.
 */
export async function requireBusiness(
  ctx: Ctx,
  businessId: Id<"businesses">,
): Promise<Doc<"businesses">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  const business = await ctx.db.get(businessId);
  if (business === null || business.ownerId !== userId) {
    throw new Error("Business not found");
  }
  return business;
}
