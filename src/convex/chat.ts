"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { parseMessage } from "./lib/parser";
import { formatKES, productKey } from "./lib/reply";
import {
  dayLabel,
  rangeWindow,
  startOfNairobiDay,
  startOfNairobiDaysAgo,
  type Range,
} from "./lib/time";
import { vly } from "../lib/vly-integrations";

/** Ask the gateway LLM for a short conversational reply. Returns null on failure. */
async function askAI(system: string, user: string): Promise<string | null> {
  try {
    const res = await vly.ai.completion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      maxTokens: 220,
    });
    if (res.success && res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content.trim();
    }
    return null;
  } catch {
    return null;
  }
}

function unknownReply(): string {
  return [
    "I didn't quite catch that. You can say things like:",
    "",
    "• \"I sold 3 shirts for 1500\"",
    "• \"Nimeuza mashati matatu kwa 1500\"",
    "• \"Paid transport 300\"",
    "• \"Bought 10 pencils at 500\"",
    "• \"John owes me 500\" / \"John paid 200\"",
    "",
    "Or ask: sales today · profit this week · inventory · low stock ·",
    "top customers · generate report · help",
  ].join("\n");
}

function helpReply(): string {
  return [
    "*Smart Hustle AI* — your business assistant 🇰🇪",
    "",
    "Record (just type naturally, English / Kiswahili / Sheng):",
    "• \"I sold 2 shirts for 1500\" · \"Nimeuza viatu mbili 2000\"",
    "• \"Paid transport 300\" · \"Nimelipa transport 300\"",
    "• \"Bought 10 pencils at 500\" · \"Nimenunua kalamu 10 kwa 500\"",
    "• \"John owes me 500\" · \"John paid 200\"",
    "",
    "Ask:",
    "• sales / profit / expenses (today, this week, this month)",
    "• inventory · low stock · customers · top customers",
    "• generate report · summary · help",
  ].join("\n");
}

export const send = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const business = await ctx.runQuery(internal.business.myBusinessInternal, {});
    if (!business) throw new Error("Create your shop first");
    const now = Date.now();
    const text = args.message.trim().slice(0, 500);
    if (!text) throw new Error("Message is empty");

    await ctx.runMutation(internal.chatStore.insertMessage, {
      businessId: business._id,
      role: "user",
      content: text,
    });

    const parsed = parseMessage(text);
    let reply: string;

    if (parsed.kind === "transaction") {
      reply = await handleTransaction(ctx, business._id, parsed.tx, now);
    } else if (parsed.kind === "command") {
      reply = await handleCommand(ctx, business._id, parsed.command, parsed.range, now);
    } else {
      const ai = await askAI(
        "You are Smart Hustle AI, a business assistant for Kenyan small traders (kiosks, shops, salons, market sellers). They chat in English, Swahili or Sheng. Reply briefly and warmly (max 3 short lines). If they seem to be recording a sale, expense or purchase, show them an example of how to phrase it.",
        text,
      );
      reply = ai ?? unknownReply();
    }

    await ctx.runMutation(internal.chatStore.insertMessage, {
      businessId: business._id,
      role: "assistant",
      content: reply,
    });
    return reply;
  },
});

// ---------------------------------------------------------------------------
// Transaction handling
// ---------------------------------------------------------------------------

async function handleTransaction(
  ctx: any,
  businessId: any,
  tx: import("./lib/parser").ExtractedTx,
  now: number,
): Promise<string> {
  const { type } = tx;

  if (tx.missingAmount) {
    const what =
      type === "sale"
        ? `the sale of ${tx.quantity ?? 1} ${tx.productName}`
        : type === "purchase"
          ? `the purchase of ${tx.quantity ?? 1} ${tx.productName}`
          : `the expense for ${tx.productName}`;
    return `I understood ${what}, but I couldn't find the amount. Try again like \"${type === "sale" ? "I sold 3 shirts for 1500" : type === "purchase" ? "bought 10 pencils at 500" : "paid transport 300"}\".`;
  }

  await ctx.runMutation(api.transactions.recordTransaction, {
    type,
    productName: tx.productName,
    quantity: tx.quantity,
    amount: tx.amount,
    customerName: tx.customerName,
    source: "chat",
  });

  const qty = tx.quantity ?? 1;
  const who = tx.customerName ? ` for ${tx.customerName}` : "";
  switch (type) {
    case "sale":
      return [
        `✅ Sale recorded${who}: ${qty} × ${tx.productName} — ${formatKES(tx.amount)}`,
        stockNote(ctx, businessId, tx.productName),
      ]
        .filter(Boolean)
        .join("\n");
    case "purchase":
      return `📦 Purchase recorded: ${qty} × ${tx.productName} for ${formatKES(tx.amount)} — stock updated.`;
    case "expense":
      return `🧾 Expense recorded: ${tx.productName} — ${formatKES(tx.amount)}.`;
    case "debt":
      return `📝 Debt recorded: ${tx.customerName} owes ${formatKES(tx.amount)}${tx.productName ? ` (${tx.productName})` : ""}.`;
    case "payment_received":
      return `💰 Payment received from ${tx.customerName}: ${formatKES(tx.amount)}. Their balance has been reduced.`;
  }
  return unknownReply();
}

async function stockNote(
  ctx: any,
  businessId: any,
  productName?: string,
): Promise<string> {
  if (!productName) return "";
  const items = await ctx.runQuery(api.inventory.list, {});
  const key = productKey(productName);
  const item = items.find(
    (i: any) =>
      i.productName.toLowerCase() === productName.toLowerCase() ||
      productKey(i.productName) === key,
  );
  if (!item) return "";
  if (item.quantity <= 0) return `⚠️ ${item.productName} is now out of stock.`;
  if (item.quantity <= item.lowStockThreshold) {
    return `⚠️ ${item.productName} is running low: ${item.quantity} left.`;
  }
  return `Stock left: ${item.quantity}.`;
}

// ---------------------------------------------------------------------------
// Command handling
// ---------------------------------------------------------------------------

async function handleCommand(
  ctx: any,
  businessId: any,
  command: string,
  range: Range,
  now: number,
): Promise<string> {
  const { from, label } = rangeWindow(range, now);

  if (command === "sales" || command === "profit" || command === "expenses") {
    const rows = await ctx.runQuery(api.transactions.recent, { type: undefined });
    const windowRows = rows.filter((r: any) => r.createdAt >= from);
    let sales = 0, salesCount = 0, expenses = 0, purchases = 0;
    for (const r of windowRows) {
      if (r.type === "sale") { sales += r.amount; salesCount++; }
      else if (r.type === "expense") expenses += r.amount;
      else if (r.type === "purchase") purchases += r.amount;
    }
    const profit = sales - expenses - purchases;

    if (command === "sales") {
      if (salesCount === 0) return `No sales ${label} yet. Record one by typing \"I sold 2 shirts for 1000\".`;
      const byProduct = new Map<string, number>();
      for (const r of windowRows) {
        if (r.type === "sale" && r.productName) {
          const k = r.productName.toLowerCase().trim();
          byProduct.set(k, (byProduct.get(k) ?? 0) + r.amount);
        }
      }
      const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const lines = top.map(
        ([name, total]) => `• ${name}: ${formatKES(total)}`,
      );
      return [
        `💵 Sales ${label}: ${formatKES(sales)} from ${salesCount} sale${salesCount === 1 ? "" : "s"}.`,
        lines.length ? "" : "",
        ...lines,
      ]
        .filter((l) => l !== "")
        .join("\n");
    }
    if (command === "expenses") {
      if (expenses === 0 && purchases === 0) {
        return `No expenses ${label}. Record one with \"paid transport 300\".`;
      }
      const byCat = new Map<string, number>();
      for (const r of windowRows) {
        if (r.type === "expense" && r.productName) {
          const k = r.productName.toLowerCase().trim();
          byCat.set(k, (byCat.get(k) ?? 0) + r.amount);
        }
      }
      const lines = [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => `• ${name}: ${formatKES(total)}`);
      return [
        `🧾 Expenses ${label}: ${formatKES(expenses)} (+ purchases ${formatKES(purchases)}).`,
        ...lines,
      ]
        .filter((l) => l !== "")
        .join("\n");
    }
    // profit
    return [
      `📈 ${cap(label)}:`,
      `Sales: ${formatKES(sales)}`,
      `Expenses: ${formatKES(expenses)}`,
      `Purchases: ${formatKES(purchases)}`,
      `*Profit: ${formatKES(profit)}*`,
    ].join("\n");
  }

  if (command === "inventory" || command === "low_stock") {
    const items: any[] = await ctx.runQuery(api.inventory.list, {});
    if (items.length === 0) {
      return command === "low_stock"
        ? "No stock recorded yet, so nothing is low. Add products on the Inventory page or type \"bought 10 pencils at 500\"."
        : "Your inventory is empty. Add products on the Inventory page, or just tell me: \"bought 10 pencils at 500\".";
    }
    const low = items.filter((i) => i.quantity <= i.lowStockThreshold);
    if (command === "low_stock") {
      if (low.length === 0) return `✅ Nothing is low — all ${items.length} products have healthy stock.`;
      const lines = low
        .sort((a, b) => a.quantity - b.quantity)
        .map(
          (i) =>
            `• ${i.productName}: ${i.quantity} left (alert at ${i.lowStockThreshold})`,
        );
      return [`⚠️ *${low.length} low-stock product${low.length === 1 ? "" : "s"}:*`, ...lines].join("\n");
    }
    const value = items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
    const lines = items
      .slice(0, 10)
      .map(
        (i) =>
          `• ${i.productName}: ${i.quantity} ${i.quantity <= i.lowStockThreshold ? "⚠️" : ""} @ ${formatKES(i.sellingPrice)}`,
      );
    const more =
      items.length > 10 ? `\n…and ${items.length - 10} more (see Inventory page).` : "";
    return [
      `📦 Inventory (${items.length} products, stock value ${formatKES(value)}):`,
      ...lines,
      ...(low.length ? ["", `⚠️ ${low.length} product${low.length === 1 ? "" : "s"} low on stock.`] : []),
      more,
    ]
      .filter((l) => l !== "")
      .join("\n");
  }

  if (command === "customers" || command === "top_customers") {
    const customers: any[] = await ctx.runQuery(api.customers.list, {});
    if (customers.length === 0) {
      return "No customers yet. They're added automatically when you record a sale or debt with a name, e.g. \"I sold 2 shirts to Mary for 1000\".";
    }
    const withDebt = customers.filter((c) => c.balance > 0);
    if (command === "top_customers") {
      const lines = customers
        .slice(0, 5)
        .map((c, i) => `${i + 1}. ${c.name} — ${formatKES(c.totalSpent)}`);
      return [`🏆 *Top customers by spending:*`, ...lines].join("\n");
    }
    const debtLines =
      withDebt.length > 0
        ? [
            "",
            "Outstanding balances:",
            ...withDebt
              .slice(0, 8)
              .map((c) => `• ${c.name}: ${formatKES(c.balance)}`),
          ]
        : [];
    const totalDebt = withDebt.reduce((s, c) => s + c.balance, 0);
    return [
      `👥 ${customers.length} customer${customers.length === 1 ? "" : "s"} in total.`,
      totalDebt > 0 ? `Total owed to you: ${formatKES(totalDebt)}.` : "No outstanding balances. 🎉",
      ...debtLines,
    ]
      .filter((l) => l !== "")
      .join("\n");
  }

  if (command === "summary") {
    const overview: any = await ctx.runQuery(api.analytics.overview, {
      range: "today",
    });
    const week: any = await ctx.runQuery(api.analytics.overview, {
      range: "week",
    });
    return [
      `📊 *Business snapshot*`,
      `Today: sales ${formatKES(overview.sales)} · expenses ${formatKES(overview.expenses)} · profit ${formatKES(overview.profit)}`,
      `Last 7 days: sales ${formatKES(week.sales)} · profit ${formatKES(week.profit)}`,
      `Stock value: ${formatKES(overview.stockValue)} · Low stock: ${overview.lowStockCount}`,
      `Customers: ${overview.totalCustomers} · Owed to you: ${formatKES(overview.outstandingDebt)}`,
    ].join("\n");
  }

  if (command === "report") {
    return [
      "📄 I can't attach files here, but generating a PDF takes two taps:",
      "1. Open the *Reports* page",
      "2. Choose the period and tap *Download PDF*",
      "",
      "The PDF includes sales, expenses, profit, inventory and customer summaries.",
    ].join("\n");
  }

  return helpReply();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
