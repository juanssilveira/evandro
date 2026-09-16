import { pgTable, text, timestamp, uuid, bigint, index } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id")
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),
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
    index("videos_public_id_idx").on(t.publicId),
  ]
);

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
