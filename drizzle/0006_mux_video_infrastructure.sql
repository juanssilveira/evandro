ALTER TABLE "videos" DROP COLUMN IF EXISTS "storage_key";--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "mux_upload_id" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "mux_asset_id" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "mux_playback_id" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "status" text DEFAULT 'waiting_upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "duration" real;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "error_message" text;--> statement-breakpoint
CREATE INDEX "videos_mux_upload_id_idx" ON "videos" USING btree ("mux_upload_id");--> statement-breakpoint
CREATE INDEX "videos_mux_asset_id_idx" ON "videos" USING btree ("mux_asset_id");