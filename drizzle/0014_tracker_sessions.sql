CREATE TABLE IF NOT EXISTS "tracker_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
	"video_id" uuid NOT NULL REFERENCES "videos"("id") ON DELETE cascade,
	"session_id" text NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"first_foreground_at" timestamp,
	"ended_at" timestamp,
	"started_in_background_autoplay" boolean DEFAULT false NOT NULL,
	"duration_seconds" double precision,
	"last_position_seconds" double precision,
	"max_position_seconds" double precision,
	"watch_time_ms" integer DEFAULT 0 NOT NULL,
	"unique_watched_seconds" double precision DEFAULT 0 NOT NULL,
	"completion_percent" double precision DEFAULT 0 NOT NULL,
	"watched_ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pause_count" integer DEFAULT 0 NOT NULL,
	"seek_count" integer DEFAULT 0 NOT NULL,
	"rate_change_count" integer DEFAULT 0 NOT NULL,
	"fullscreen_count" integer DEFAULT 0 NOT NULL,
	"buffer_count" integer DEFAULT 0 NOT NULL,
	"buffer_time_ms" integer DEFAULT 0 NOT NULL,
	"started_from_resume" boolean DEFAULT false NOT NULL,
	"resume_from_seconds" double precision,
	"resume_decision" text DEFAULT 'none' NOT NULL,
	"quality_summary" jsonb,
	"performance_summary" jsonb,
	"ended" boolean DEFAULT false NOT NULL,
	"has_error" boolean DEFAULT false NOT NULL,
	"last_error_type" text,
	CONSTRAINT "tracker_sessions_video_id_session_id_unique" UNIQUE("video_id","session_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracker_sessions_account_id_created_at_idx" ON "tracker_sessions" ("account_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracker_sessions_video_id_created_at_idx" ON "tracker_sessions" ("video_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracker_sessions_created_at_idx" ON "tracker_sessions" ("created_at");
