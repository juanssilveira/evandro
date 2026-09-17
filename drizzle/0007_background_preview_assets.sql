ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "background_preview_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "background_preview_key" text;
