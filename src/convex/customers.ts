import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getMyBusiness, requireBusiness } from "./lib/ownership";
import { nameKey } from "./lib/reply";

/** All customers for the current business (highest spenders first). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const business = await getMyBusiness(ctx);
    if (!business) return [];
    const all = await ctx.db
      .query("customers")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    return all.sort((a, b) => b.totalSpent - a.totalSpent);
  },
});

/** Add a customer manually. */
export const add = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const business = await getMyBusiness(ctx);
    if (!business) throw new Error("Create your shop first");
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("Customer name is required");
    const all = await ctx.db
      .query("customers")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (all.some((c) => nameKey(c.name) === nameKey(name))) {
      throw new Error(`"${name}" is already a customer`);
    }
    return ctx.db.insert("customers", {
      businessId: business._id,
      name,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      totalSpent: 0,
      balance: 0,
      createdAt: Date.now(),
    });
  },
});

/** Update contact details. */
export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("Customer not found");
    await requireBusiness(ctx, customer.businessId);
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("Customer name is required");
    await ctx.db.patch(args.id, {
      name,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
    });
  },
});

/** Delete a customer. */
export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("Customer not found");
    await requireBusiness(ctx, customer.businessId);
    await ctx.db.delete(args.id);
  },
});

/** Recent sale transactions involving a specific customer (spending history). */
export const history = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const business = await getMyBusiness(ctx);
    if (!business) return [];
    const target = nameKey(args.name);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .order("desc")
      .take(500);
    return rows.filter(
      (r) =>
        r.customerName !== undefined && nameKey(r.customerName) === target,
    );
  },
});

/** Record a debt payment for a customer (reduces their balance). */
export const recordPayment = mutation({
  args: { id: v.id("customers"), amount: v.number() },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("Customer not found");
    await requireBusiness(ctx, customer.businessId);
    if (args.amount <= 0) throw new Error("Amount must be positive");
    const payment = Math.min(args.amount, customer.balance);
    const now = Date.now();
    await ctx.db.insert("transactions", {
      businessId: customer.businessId,
      type: "payment_received",
      amount: payment,
      customerName: customer.name,
      source: "manual",
      createdAt: now,
    });
    await ctx.db.patch(args.id, {
      balance: Math.round((customer.balance - payment) * 100) / 100,
    });
    return payment;
  },
});
