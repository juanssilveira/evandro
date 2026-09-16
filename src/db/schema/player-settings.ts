import { pgTable, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { videos } from "./videos";
import type { PlayerConfig } from "@/types/player-config";
import { DEFAULT_PLAYER_CONFIG } from "@/types/player-config";

export const videoPlayerSettings = pgTable("video_player_settings", {
  videoId: uuid("video_id")
    .primaryKey()
    .references(() => videos.id, { onDelete: "cascade" }),
  config: jsonb("config").$type<PlayerConfig>().notNull().default(DEFAULT_PLAYER_CONFIG),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type VideoPlayerSetting = typeof videoPlayerSettings.$inferSelect;
export type NewVideoPlayerSetting = typeof videoPlayerSettings.$inferInsert;
