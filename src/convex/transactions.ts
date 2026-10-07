import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getMyBusiness, requireBusiness } from "./lib/ownership";
import { nameKey, productKey } from "./lib/reply";
import { rangeWindow, type Range } from "./lib/time";

const typeValidator = v.union(
  v.literal("sale"),
  v.literal("expense"),
  v.literal("purchase"),
  v.literal("payment_received"),
  v.literal("debt"),
);

/** Recent transactions for the current business (onboarding lists). */
export const recent = query({
  args: { type: v.optional(typeValidator), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const business = await getMyBusiness(ctx);
    if (!business) return [];
    if (args.type) {
      return ctx.db
        .query("transactions")
        .withIndex("by_business_type", (q) =>
          q
            .eq("businessId", business._id)
            .eq("type", args.type as
              | "sale"
              | "expense"
              | "purchase"
              | "payment_received"
              | "debt"),
        )
        .order("desc")
        .take(50);
    }
    return ctx.db
      .query("transactions")
      .withIndex("by_business", (q) =>
        q.eq("businessId", business._id),
      )
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * Aggregated period summary. Profit = Σ(sale) − Σ(expense) − Σ(purchase).
 * Debt and payment_received don't affect profit.
 */
export const summary = query({
  args: { range: v.string() },
  handler: async (ctx, args) => {
    const business = await getMyBusiness(ctx);
    if (!business) return null;
    const { from } = rangeWindow(args.range as Range, Date.now());
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_business", (q) =>
        q.eq("businessId", business._id).gte("createdAt", from),
      )
      .take(1000);

    const totals = { sale: 0, expense: 0, purchase: 0, payment_received: 0, debt: 0 };
    const counts = { sale: 0, expense: 0, purchase: 0, payment_received: 0, debt: 0 };
    for (const r of rows) {
      totals[r.type] += r.amount;
      counts[r.type] += 1;
    }
    return {
      from,
      sales: totals.sale,
      salesCount: counts.sale,
      expenses: totals.expense,
      purchases: totals.purchase,
      payments: totals.payment_received,
      debts: totals.debt,
      profit: totals.sale - totals.expense - totals.purchase,
    };
  },
});

/**
 * Record one transaction and apply all ledger effects:
 *  sale      -> inventory stock − saleQuantity, customer.totalSpent + amount
 *  purchase  -> auto-create/update inventory item (quantity +1 set)
 *  inventory -> set stock quantity directly
 *  debt      -> customer.balance + amount
 *  payment_received -> customer.balance − amount
 */
export const recordTransaction = mutation({
  args: {
    type: typeValidator,
    productName: v.optional(v.string()),
    quantity: v.optional(v.number()),
    amount: v.number(),
    customerName: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const business = await getMyBusiness(ctx);
    if (!business) throw new Error("Create your shop first");
    const now = Date.now();
    if (args.amount < 0) throw new Error("Amount cannot be negative");

    const txId = await ctx.db.insert("transactions", {
      businessId: business._id,
      type: args.type,
      productName: args.productName?.trim() || undefined,
      quantity: args.quantity ?? undefined,
      amount: args.amount,
      customerName: args.customerName?.trim() || undefined,
      source: args.source ?? "manual",
      createdAt: now,
    });

    // ---- ledger effects ----
    if (args.type === "sale" && args.productName) {
      decrementStock(ctx, business._id, args.productName, args.quantity ?? 1);
    }
    if (args.type === "sale" && args.customerName) {
      await adjustCustomer(ctx, business._id, args.customerName, { spentDelta: args.amount });
    }
    if (args.type === "purchase" && args.productName && (args.quantity ?? 1) > 0) {
      const qty = args.quantity ?? 1;
      const unit = args.amount / qty;
      await upsertInventory(ctx, business._id, args.productName, qty, unit, now);
    }
    if (args.type === "payment_received" && args.customerName) {
      await adjustCustomer(ctx, business._id, args.customerName, { balanceDelta: -args.amount });
    }
    if (args.type === "debt" && args.customerName) {
      await adjustCustomer(ctx, business._id, args.customerName, { balanceDelta: args.amount });
    }

    return txId;
  },
});

/** Internal: decrement inventory for a sale. */
async function decrementStock(
  ctx: any,
  businessId: any,
  productName: string,
  qty: number,
) {
  const key = productKey(productName);
  const items = await ctx.db
    .query("inventory")
    .withIndex("by_business_name", (q: any) =>
      q.eq("businessId", businessId).eq("productName", productName),
    )
    .collect();
  let target = items.find(
    (i: any) => i.productName.toLowerCase() === productName.toLowerCase(),
  );
  if (!target) {
    const all = await ctx.db
      .query("inventory")
      .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
      .collect();
    target = all.find(
      (i: any) => productKey(i.productName) === key,
    );
  }
  if (target) {
    const newQty = Math.max(0, target.quantity - qty);
    await ctx.db.patch(target._id, { quantity: newQty, updatedAt: Date.now() });
  }
}

/** Internal: create or extend an inventory item after a purchase. */
async function upsertInventory(
  ctx: any,
  businessId: any,
  productName: string,
  qty: number,
  costPerUnit: number,
  now: number,
) {
  const key = productKey(productName);
  const existing = await ctx.db
    .query("inventory")
    .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
    .collect();
  const match =
    existing.find(
      (i: any) => i.productName.toLowerCase() === productName.toLowerCase(),
    ) ?? existing.find((i: any) => productKey(i.productName) === key);

  if (match) {
    const newCost = costPerUnit > 0 ? costPerUnit : match.costPrice;
    await ctx.db.patch(match._id, {
      quantity: match.quantity + qty,
      costPrice: newCost,
    updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("inventory", {
    businessId,
    productName: productName.trim(),
    quantity: qty,
    lowStockThreshold: 5,
    costPrice: Math.round(costPerUnit * 100) / 100,
    sellingPrice: Math.round(costPerUnit * 1.25 * 100) / 100, // 25% margin default
    createdAt: now,
    updatedAt: now,
  });
}

/** Internal: create or update a customer's totals/balance. */
async function adjustCustomer(
  ctx: any,
  businessId: any,
  customerName: string,
  { spentDelta = 0, balanceDelta = 0 }: { spentDelta?: number; balanceDelta?: number },
) {
  const k = nameKey(customerName);
  const all = await ctx.db
    .query("customers")
    .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
    .collect();
  const match =
    all.find((c: any) => c.name.toLowerCase() === customerName.toLowerCase()) ??
    all.find((c: any) => nameKey(c.name) === k);
  const now = Date.now();
  if (match) {
    await ctx.db.patch(match._id, {
      totalSpent: match.totalSpent + spentDelta,
      balance: Math.max(0, match.balance + balanceDelta),
    });
  } else {
    await ctx.db.insert("customers", {
      businessId,
      name: customerName.trim(),
      totalSpent: spentDelta,
      balance: Math.max(0, balanceDelta),
      createdAt: now,
    });
  }
}

/** Delete a transaction (undo). Ownership is verified first. */
export const deleteTransaction = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.id);
    if (!tx) throw new Error("Transaction not found");
    await requireBusiness(ctx, tx.businessId);
    await ctx.db.delete(args.id);
  },
});
