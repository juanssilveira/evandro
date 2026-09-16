CREATE TABLE "video_player_settings" (
	"video_id" uuid PRIMARY KEY NOT NULL,
	"config" jsonb DEFAULT '{"version":1,"playback":{"autoplay":false,"backgroundAutoplay":false},"controls":{"hidden":false,"fullscreen":{"enabled":true,"button":true,"doubleClick":true,"keyboardF":true}},"progress":{"fake":{"enabled":false,"targetPercent":0.85,"targetSeconds":10}},"development":{"debug":false}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_player_settings" ADD CONSTRAINT "video_player_settings_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "video_player_settings" ("video_id", "config")
SELECT id, jsonb_build_object(
  'version', 1,
  'playback', jsonb_build_object('autoplay', false, 'backgroundAutoplay', false),
  'controls', jsonb_build_object('hidden', false, 'fullscreen', jsonb_build_object('enabled', true, 'button', true, 'doubleClick', true, 'keyboardF', true)),
  'progress', jsonb_build_object('fake', jsonb_build_object('enabled', false, 'targetPercent', 0.85, 'targetSeconds', 10)),
  'development', jsonb_build_object('debug', COALESCE(debug_enabled, false))
)
FROM "videos"
ON CONFLICT ("video_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "videos" DROP COLUMN "debug_enabled";