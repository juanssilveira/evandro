import { pgTable, text, timestamp, uuid, bigint, index } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("videos_account_id_created_at_idx").on(t.accountId, t.createdAt),
  ]
);

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
