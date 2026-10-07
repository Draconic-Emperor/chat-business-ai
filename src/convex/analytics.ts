import { query } from "./_generated/server";
import { v } from "convex/values";
import { getMyBusiness } from "./lib/ownership";
import {
  MS_PER_DAY,
  NAIROBI_OFFSET_MS,
  dayLabel,
  monthLabel,
  rangeWindow,
  startOfNairobiDay,
  startOfNairobiDaysAgo,
  type Range,
} from "./lib/time";

interface DayBucket {
  sales: number;
  expenses: number;
  purchases: number;
  profit: number;
}

function emptyBuckets(): Map<number, DayBucket> {
  return new Map();
}

function bucketFor(
  map: Map<number, DayBucket>,
  start: number,
): DayBucket {
  let b = map.get(start);
  if (!b) {
    b = { sales: 0, expenses: 0, purchases: 0, profit: 0 };
    map.set(start, b);
  }
  return b;
}

/**
 * Daily series for the analytics page. Sales, expenses, purchases and
 * profit per Nairobi calendar day over the requested window.
 */
export const dailySeries = query({
  args: { days: v.number(), range: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const business = await getMyBusiness(ctx);
    if (!business) return [];
    const days = Math.min(Math.max(Math.round(args.days), 1), 120);
    const from = startOfNairobiDaysAgo(Date.now(), days - 1);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_business", (q) =>
        q.eq("businessId", business._id).gte("createdAt", from),
      )
      .take(5000);

    const map = emptyBuckets();
    for (const r of rows) {
      const start = startOfNairobiDay(r.createdAt);
      const b = bucketFor(map, start);
      if (r.type === "sale") {
        b.sales += r.amount;
        b.profit += r.amount;
      } else if (r.type === "expense") {
        b.expenses += r.amount;
        b.profit -= r.amount;
      } else if (r.type === "purchase") {
        b.purchases += r.amount;
        b.profit -= r.amount;
      }
    }

    const out: Array<{
      key: string;
      label: string;
      sales: number;
      expenses: number;
      purchases: number;
      profit: number;
    }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = startOfNairobiDaysAgo(Date.now(), i);
      const b = map.get(start) ?? {
        sales: 0, expenses: 0, purchases: 0, profit: 0,
      };
      out.push({ key: `d${i}`, label: dayLabel(start), ...b });
    }
    return out;
  },
});

/**
 * Monthly series (last N months, Nairobi calendar months) for trends.
 */
export const monthlySeries = query({
  args: { months: v.number() },
  handler: async (ctx, args) => {
    const business = await getMyBusiness(ctx);
    if (!business) return [];
    const months = Math.min(Math.max(Math.round(args.months), 1), 24);
    const nowShifted = new Date(Date.now() + NAIROBI_OFFSET_MS);

    const monthStarts: number[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(nowShifted.getTime());
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - i);
      monthStarts.push(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - NAIROBI_OFFSET_MS,
      );
    }

    const firstFrom = monthStarts[0];
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_business", (q) =>
        q.eq("businessId", business._id).gte("createdAt", firstFrom),
      )
      .take(10000);

    const map = emptyBuckets();
    for (const r of rows) {
      // Greatest month start <= r.createdAt (monthStarts is ascending).
      let mStart = monthStarts[0];
      for (let i = monthStarts.length - 1; i >= 0; i--) {
        if (r.createdAt >= monthStarts[i]) {
          mStart = monthStarts[i];
          break;
        }
      }
      const b = bucketFor(map, mStart);
      if (r.type === "sale") {
        b.sales += r.amount;
        b.profit += r.amount;
      } else if (r.type === "expense") {
        b.expenses += r.amount;
        b.profit -= r.amount;
      } else if (r.type === "purchase") {
        b.purchases += r.amount;
        b.profit -= r.amount;
      }
    }

    return monthStarts.map((start) => {
      const b = map.get(start) ?? {
        sales: 0, expenses: 0, purchases: 0, profit: 0,
      };
      return { key: `m${start}`, label: monthLabel(start), ...b };
    });
  },
});

/** Dashboard cards + analytics totals for a named range. */
export const overview = query({
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
      .take(5000);

    let sales = 0, salesCount = 0, expenses = 0, purchases = 0, payments = 0, debts = 0;
    const productSales = new Map<string, number>();
    for (const r of rows) {
      if (r.type === "sale") {
        sales += r.amount;
        salesCount += 1;
        if (r.productName) {
          const k = r.productName.trim().toLowerCase();
          productSales.set(k, (productSales.get(k) ?? 0) + r.amount);
        }
      } else if (r.type === "expense") expenses += r.amount;
      else if (r.type === "purchase") purchases += r.amount;
      else if (r.type === "payment_received") payments += r.amount;
      else if (r.type === "debt") debts += r.amount;
    }

    const inv = await ctx.db
      .query("inventory")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    let stockValue = 0;
    let lowStockCount = 0;
    for (const item of inv) {
      stockValue += item.costPrice * item.quantity;
      if (item.quantity <= item.lowStockThreshold) lowStockCount += 1;
    }

    const custs = await ctx.db
      .query("customers")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    const totalCustomers = custs.length;
    const outstandingDebt = custs.reduce((s, c) => s + c.balance, 0);
    const topProducts = [...productSales.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    return {
      sales,
      salesCount,
      expenses,
      purchases,
      payments,
      debts,
      profit: sales - expenses - purchases,
      stockValue,
      lowStockCount,
      productCount: inv.length,
      totalCustomers,
      outstandingDebt,
      topProducts,
      windowLabel: rangeWindow(args.range as Range, Date.now()).label,
      avgPerDay:
        args.range === "week" || args.range === "month"
          ? Math.round(
              ((sales /
                ((Date.now() - from) / MS_PER_DAY + 1)) *
                100),
            ) / 100
          : sales,
    };
  },
});
