ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "redeem_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"plan_code" text DEFAULT 'pro' NOT NULL,
	"duration_days" integer NOT NULL,
	"used_at" timestamp,
	"used_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "redeem_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_used_by_user_id_user_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "redeem_codes_code_hash_idx" ON "redeem_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "redeem_codes_used_by_user_id_idx" ON "redeem_codes" USING btree ("used_by_user_id");
