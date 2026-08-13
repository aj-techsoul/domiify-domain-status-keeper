import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

/**
 * Domiify database schema (SQLite via Drizzle ORM).
 *
 * Design notes:
 * - IDs are text UUIDs (generated in application code) for portability.
 * - Dates are stored as ISO-8601 strings (YYYY-MM-DD or full timestamps) so
 *   they remain human-readable inside the .db file and sort correctly.
 * - "Derived" values such as days-remaining or domain status are NEVER
 *   stored - they are always computed at read time from expiryDate vs now.
 *   See src/lib/domain-utils.ts.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  currency: text("currency").notNull().default("INR"),
  theme: text("theme").notNull().default("system"), // "light" | "dark" | "system"
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * Customer/Owner entity (Domiify 2.0). A customer can own many domains.
 * Deliberately NOT nested inside `domains` - domain rows only hold a
 * `customerId` pointer, so customer info is never duplicated per-domain.
 */
export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    username: text("username").notNull().default(""), // GitHub / generic handle
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    company: text("company").notNull().default(""),
    website: text("website").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    // Backs the dedup lookups in lib/customers.ts and the smart search -
    // without these, every "does this customer already exist" check and
    // every search keystroke would force a full table scan.
    userEmailIdx: index("customers_user_email_idx").on(table.userId, table.email),
    userUsernameIdx: index("customers_user_username_idx").on(table.userId, table.username),
    userNameIdx: index("customers_user_name_idx").on(table.userId, table.fullName),
    userCompanyIdx: index("customers_user_company_idx").on(table.userId, table.company),
  }),
);

export const domains = sqliteTable(
  "domains",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    name: text("name").notNull(), // e.g. example.com
    registrar: text("registrar").notNull(),
    purchaseDate: text("purchase_date").notNull(), // YYYY-MM-DD
    expiryDate: text("expiry_date").notNull(), // YYYY-MM-DD
    renewalPrice: real("renewal_price").notNull(),
    category: text("category").notNull().default("Other"),
    notes: text("notes").notNull().default(""),
    autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userNameIdx: index("domains_user_name_idx").on(table.userId, table.name),
    customerIdx: index("domains_customer_idx").on(table.customerId),
    userExpiryIdx: index("domains_user_expiry_idx").on(table.userId, table.expiryDate),
  }),
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domainId: text("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    domainNameSnapshot: text("domain_name_snapshot").notNull(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerNameSnapshot: text("customer_name_snapshot").notNull().default(""),
    transactionId: text("transaction_id").notNull().unique(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    method: text("method").notNull(), // UPI | Credit Card | Debit Card | Net Banking | Wallet
    status: text("status").notNull().default("Success"), // Success | Failed | Pending
    renewalPeriodYears: integer("renewal_period_years").notNull().default(1),
    previousExpiryDate: text("previous_expiry_date").notNull(),
    newExpiryDate: text("new_expiry_date").notNull(),
    date: text("date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    domainIdx: index("payments_domain_idx").on(table.domainId),
    customerIdx: index("payments_customer_idx").on(table.customerId),
    userDateIdx: index("payments_user_date_idx").on(table.userId, table.date),
  }),
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domainId: text("domain_id").references(() => domains.id, { onDelete: "cascade" }),
    domainNameSnapshot: text("domain_name_snapshot").notNull(),
    type: text("type").notNull(), // Upcoming | Reminder | Warning | Urgent | Critical | Expired | Renewed | PaymentSuccess | NewDomain | System
    message: text("message").notNull(),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    // Soft-delete flag (Domiify 2.0). `syncNotificationsForUser` re-derives
    // threshold notifications on every load and is keyed on "does a
    // domainId:type row already exist" - a hard delete would make that key
    // look free again and the exact notification the user just dismissed
    // would silently reappear on the next fetch. Dismissed rows stay in the
    // table (so the key still blocks recreation) but are filtered out of
    // every read the UI uses.
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    date: text("date")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userReadIdx: index("notifications_user_read_idx").on(table.userId, table.read),
    userDateIdx: index("notifications_user_date_idx").on(table.userId, table.date),
    userDismissedIdx: index("notifications_user_dismissed_idx").on(table.userId, table.dismissed),
  }),
);

/**
 * Activity/audit log (Domiify 2.0). One row per meaningful mutation, shown
 * on the dashboard's Recent Activity feed.
 */
export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    // customer_created | customer_updated | customer_deleted | domain_created |
    // domain_updated | domain_deleted | domain_renewed | payment_recorded
    message: text("message").notNull(),
    entityType: text("entity_type").notNull().default(""),
    entityId: text("entity_id").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userDateIdx: index("activity_user_date_idx").on(table.userId, table.createdAt),
  }),
);

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notify30: integer("notify_30", { mode: "boolean" }).notNull().default(true),
  notify15: integer("notify_15", { mode: "boolean" }).notNull().default(true),
  notify7: integer("notify_7", { mode: "boolean" }).notNull().default(true),
  notify3: integer("notify_3", { mode: "boolean" }).notNull().default(true),
  notify1: integer("notify_1", { mode: "boolean" }).notNull().default(true),
  notifyExpired: integer("notify_expired", { mode: "boolean" }).notNull().default(true),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
