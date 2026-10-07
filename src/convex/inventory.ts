import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getMyBusiness, requireBusiness } from "./lib/ownership";
import { productKey } from "./lib/reply";

/** All inventory items for the current business (newest activity first). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const business = await getMyBusiness(ctx);
    if (!business) return [];
    return ctx.db
      .query("inventory")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .order("desc")
      .collect();
  },
});

/** Add a new product. Rejects duplicates (same name in this business). */
export const add = mutation({
  args: {
    productName: v.string(),
    quantity: v.number(),
    costPrice: v.number(),
    sellingPrice: v.number(),
    lowStockThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const business = await getMyBusiness(ctx);
    if (!business) throw new Error("Create your shop first");
    const name = args.productName.trim().slice(0, 80);
    if (!name) throw new Error("Product name is required");
    if (args.quantity < 0) throw new Error("Quantity cannot be negative");
    if (args.costPrice < 0 || args.sellingPrice < 0) {
      throw new Error("Prices cannot be negative");
    }
    const items = await ctx.db
      .query("inventory")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (
      items.some((i) => productKey(i.productName) === productKey(name))
    ) {
      throw new Error(`"${name}" is already in your inventory`);
    }
    const now = Date.now();
    return ctx.db.insert("inventory", {
      businessId: business._id,
      productName: name,
      quantity: Math.round(args.quantity),
      lowStockThreshold: Math.max(0, Math.round(args.lowStockThreshold)),
      costPrice: args.costPrice,
      sellingPrice: args.sellingPrice,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update product fields (name change is checked for duplicates). */
export const update = mutation({
  args: {
    id: v.id("inventory"),
    productName: v.string(),
    quantity: v.number(),
    costPrice: v.number(),
    sellingPrice: v.number(),
    lowStockThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Product not found");
    await requireBusiness(ctx, item.businessId);
    const name = args.productName.trim().slice(0, 80);
    if (!name) throw new Error("Product name is required");
    if (args.quantity < 0) throw new Error("Quantity cannot be negative");
    if (args.costPrice < 0 || args.sellingPrice < 0) {
      throw new Error("Prices cannot be negative");
    }
    const items = await ctx.db
      .query("inventory")
      .withIndex("by_business", (q) => q.eq("businessId", item.businessId))
      .collect();
    if (
      items.some(
        (i) =>
          i._id !== args.id && productKey(i.productName) === productKey(name),
      )
    ) {
      throw new Error(`"${name}" is already in your inventory`);
    }
    await ctx.db.patch(args.id, {
      productName: name,
      quantity: Math.round(args.quantity),
      lowStockThreshold: Math.max(0, Math.round(args.lowStockThreshold)),
      costPrice: args.costPrice,
      sellingPrice: args.sellingPrice,
      updatedAt: Date.now(),
    });
  },
});

/** Delete a product. */
export const remove = mutation({
  args: { id: v.id("inventory") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Product not found");
    await requireBusiness(ctx, item.businessId);
    await ctx.db.delete(args.id);
  },
});

/** Manually add stock to a product. */
export const addStock = mutation({
  args: { id: v.id("inventory"), quantity: v.number() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Product not found");
    await requireBusiness(ctx, item.businessId);
    if (args.quantity <= 0) throw new Error("Quantity must be positive");
    await ctx.db.patch(args.id, {
      quantity: item.quantity + Math.round(args.quantity),
      updatedAt: Date.now(),
    });
  },
});
