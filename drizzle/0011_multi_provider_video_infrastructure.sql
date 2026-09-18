ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'mux' NOT NULL;
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "provider_upload_id" text;
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "provider_video_id" text;
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "provider_playback_id" text;
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "provider_thumbnail_file_name" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_provider_idx" ON "videos" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_provider_video_id_idx" ON "videos" USING btree ("provider_video_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_provider_upload_id_idx" ON "videos" USING btree ("provider_upload_id");
--> statement-breakpoint
UPDATE "videos"
SET "provider" = 'mux',
    "provider_upload_id" = COALESCE("provider_upload_id", "mux_upload_id"),
    "provider_video_id" = COALESCE("provider_video_id", "mux_asset_id"),
    "provider_playback_id" = COALESCE("provider_playback_id", "mux_playback_id")
WHERE "provider" = 'mux' OR "provider" IS NULL;
