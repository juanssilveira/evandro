CREATE TABLE IF NOT EXISTS "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "folders" ADD CONSTRAINT "folders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folders_account_id_created_at_idx" ON "folders" USING btree ("account_id", "created_at");
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "folder_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "videos" ADD CONSTRAINT "videos_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_account_id_folder_id_idx" ON "videos" USING btree ("account_id", "folder_id");
