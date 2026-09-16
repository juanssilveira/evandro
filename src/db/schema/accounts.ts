import { pgTable, text, timestamp, uuid, unique, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const accountMembers = pgTable(
  "account_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("account_members_account_id_user_id_unique").on(t.accountId, t.userId),
    index("account_members_user_id_idx").on(t.userId),
    index("account_members_account_id_idx").on(t.accountId),
  ]
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountMember = typeof accountMembers.$inferSelect;
export type NewAccountMember = typeof accountMembers.$inferInsert;
