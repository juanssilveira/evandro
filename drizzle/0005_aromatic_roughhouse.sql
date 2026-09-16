ALTER TABLE "videos" ADD COLUMN "public_id" text;--> statement-breakpoint
UPDATE "videos" SET "public_id" = gen_random_uuid()::text WHERE "public_id" IS NULL;--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "videos_public_id_idx" ON "videos" USING btree ("public_id");--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_public_id_unique" UNIQUE("public_id");