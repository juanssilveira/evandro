"use client";

import { useState } from "react";
import { WatchMapPlayer } from "@/components/player/watchmap-player";
import { VideoSettings } from "./video-settings";
import { VideoEmbedCard } from "./video-embed-card";
import type { PlayerConfig } from "@/types/player-config";

interface VideoPlayerViewProps {
  videoId: string;
  playbackUrl: string;
  posterUrl?: string | null;
  backgroundPreviewUrl?: string | null;
  title: string;
  initialConfig: PlayerConfig;
  publicId: string;
  cdnUrl: string;
}

export function VideoPlayerView({
  videoId,
  playbackUrl,
  posterUrl,
  backgroundPreviewUrl,
  title,
  initialConfig,
  publicId,
  cdnUrl,
}: VideoPlayerViewProps) {
  const [config, setConfig] = useState<PlayerConfig>(initialConfig);

  const handleConfigChange = (updatedConfig: PlayerConfig) => {
    setConfig(updatedConfig);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[600px_minmax(0,1fr)] xl:grid-cols-[640px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
      {/* Left Column (Sticky Preview Canvas + Embed Code) */}
      <div className="w-full lg:sticky lg:top-20 space-y-4 lg:self-start">
        {/* Preview Canvas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
              Preview do Player
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {config.appearance?.aspectRatio ?? "16:9"} • {config.appearance?.accentColor ?? "purple"}
            </span>
          </div>

          <div className="relative w-full rounded-2xl border border-border/80 bg-zinc-950/5 dark:bg-zinc-950/40 p-3.5 sm:p-4 flex items-center justify-center overflow-hidden shadow-xs">
            {/* Subtle technical background grid */}
            <div
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                backgroundSize: "16px 16px",
              }}
            />

            {/* Stable Canvas Stage: fixed aspect-video viewport where the video adapts to fit inside */}
            <div className="relative w-full aspect-video flex items-center justify-center overflow-hidden">
              <WatchMapPlayer
                src={playbackUrl}
                posterUrl={posterUrl}
                backgroundPreviewUrl={backgroundPreviewUrl}
                isEditor={true}
                videoId={videoId}
                title={title}
                config={config}
                className="max-h-full max-w-full h-full w-auto"
              />
            </div>
          </div>
        </div>

        {/* Embed Code Snippet Card */}
        <VideoEmbedCard
          publicId={publicId}
          cdnUrl={cdnUrl}
          videoId={videoId}
          config={config}
          onConfigChange={handleConfigChange}
        />
      </div>

      {/* Right Column (Player Settings Categories - Fluid & Spacious) */}
      <div className="space-y-6 min-w-0">
        <VideoSettings
          videoId={videoId}
          config={config}
          onConfigChange={handleConfigChange}
        />
      </div>
    </div>
  );
}
