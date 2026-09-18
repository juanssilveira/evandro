ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_reason" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp;
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonated_by" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "disabled_reason" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text REFERENCES "user"("id") ON DELETE set null,
	"target_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_action_idx" ON "admin_audit_log" ("action");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_target_user_id_idx" ON "admin_audit_log" ("target_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_target_account_id_idx" ON "admin_audit_log" ("target_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_created_at_idx" ON "admin_audit_log" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "play_sessions_created_at_idx" ON "play_sessions" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "play_sessions_owner_created_at_idx" ON "play_sessions" ("owner_user_id", "created_at");
