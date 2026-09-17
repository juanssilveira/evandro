import { pgTable, text, timestamp, uuid, bigint, index, unique } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { videos } from "./videos";

export const subscriptionStatusEnum = ["active", "inactive"] as const;
export type SubscriptionStatus = (typeof subscriptionStatusEnum)[number];

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planCode: text("plan_code").notNull().default("pro"),
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("subscriptions_user_id_idx").on(t.userId),
    index("subscriptions_user_id_status_idx").on(t.userId, t.status),
  ]
);

export const monthlyUsage = pgTable(
  "monthly_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(), // Format: YYYY-MM (UTC)
    plays: bigint("plays", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("monthly_usage_user_id_period_key_unique").on(t.userId, t.periodKey),
    index("monthly_usage_user_id_idx").on(t.userId),
    index("monthly_usage_period_key_idx").on(t.periodKey),
  ]
);

export const playSessions = pgTable(
  "play_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    playSessionId: text("play_session_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("play_sessions_video_id_play_session_id_unique").on(
      t.videoId,
      t.playSessionId
    ),
    index("play_sessions_video_id_idx").on(t.videoId),
    index("play_sessions_owner_user_id_idx").on(t.ownerUserId),
  ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type MonthlyUsage = typeof monthlyUsage.$inferSelect;
export type NewMonthlyUsage = typeof monthlyUsage.$inferInsert;
export type PlaySession = typeof playSessions.$inferSelect;
export type NewPlaySession = typeof playSessions.$inferInsert;
