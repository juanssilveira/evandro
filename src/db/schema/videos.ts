import { pgTable, text, timestamp, uuid, bigint, index, real } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { folders } from "./folders";

export const videoStatusEnum = ["waiting_upload", "uploading", "processing", "ready", "errored"] as const;
export type VideoStatus = (typeof videoStatusEnum)[number];

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
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    muxUploadId: text("mux_upload_id"),
    muxAssetId: text("mux_asset_id"),
    muxPlaybackId: text("mux_playback_id"),
    status: text("status").notNull().default("waiting_upload"),
    duration: real("duration"),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    errorMessage: text("error_message"),
    backgroundPreviewStatus: text("background_preview_status").notNull().default("pending"),
    backgroundPreviewKey: text("background_preview_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("videos_account_id_created_at_idx").on(t.accountId, t.createdAt),
    index("videos_account_id_folder_id_idx").on(t.accountId, t.folderId),
    index("videos_public_id_idx").on(t.publicId),
    index("videos_mux_upload_id_idx").on(t.muxUploadId),
    index("videos_mux_asset_id_idx").on(t.muxAssetId),
  ]
);

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;

