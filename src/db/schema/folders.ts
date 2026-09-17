import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const folderColors = ["gray", "violet", "blue", "green", "orange"] as const;
export type FolderColor = (typeof folderColors)[number];

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("gray"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("folders_account_id_created_at_idx").on(t.accountId, t.createdAt),
  ]
);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
