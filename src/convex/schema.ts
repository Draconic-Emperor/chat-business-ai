import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // One business per owner.
    businesses: defineTable({
      ownerId: v.id("users"),
      businessName: v.string(),
      businessType: v.string(),
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    // Money movements recorded for a business.
    transactions: defineTable({
      businessId: v.id("businesses"),
      type: v.union(
        v.literal("sale"),
        v.literal("expense"),
        v.literal("purchase"),
        v.literal("payment_received"),
        v.literal("debt"),
      ),
      productName: v.optional(v.string()), // product, or expense category
      quantity: v.optional(v.number()),
      amount: v.number(), // KES
      customerName: v.optional(v.string()), // for debt / payment_received
      source: v.optional(v.string()), // "chat" | "manual"
      createdAt: v.number(),
    })
      .index("by_business", ["businessId", "createdAt"])
      .index("by_business_type", ["businessId", "type", "createdAt"]),

    // Product catalog / stock levels.
    inventory: defineTable({
      businessId: v.id("businesses"),
      productName: v.string(),
      quantity: v.number(),
      lowStockThreshold: v.number(), // alerts when quantity <= this
      costPrice: v.number(),
      sellingPrice: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_business", ["businessId", "updatedAt"])
      .index("by_business_name", ["businessId", "productName"]),

    // Customers with running totals and outstanding balances.
    customers: defineTable({
      businessId: v.id("businesses"),
      name: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      totalSpent: v.number(), // lifetime sales
      balance: v.number(), // outstanding debt (debt - payments)
      createdAt: v.number(),
    })
      .index("by_business", ["businessId", "createdAt"])
      .index("by_business_name", ["businessId", "name"]),

    // Conversation history for the AI chat assistant.
    chatMessages: defineTable({
      businessId: v.id("businesses"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      createdAt: v.number(),
    }).index("by_business", ["businessId", "createdAt"]),

    // Singletons like this are handy for app-level coordination. The
    // businesses used below are created on first dashboard load.
    statsCache: defineTable({
      businessId: v.id("businesses"),
      lastReportAt: v.optional(v.number()),
    }).index("by_business", ["businessId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
