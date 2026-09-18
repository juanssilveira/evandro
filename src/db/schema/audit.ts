import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { accounts } from "./accounts";

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(),
    targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
    targetAccountId: uuid("target_account_id").references(() => accounts.id, { onDelete: "set null" }),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("admin_audit_log_action_idx").on(t.action),
    index("admin_audit_log_target_user_id_idx").on(t.targetUserId),
    index("admin_audit_log_target_account_id_idx").on(t.targetAccountId),
    index("admin_audit_log_created_at_idx").on(t.createdAt),
  ]
);

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;
