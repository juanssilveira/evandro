"use client";

import { useState } from "react";
import { WatchMapPlayer } from "@/components/player/watchmap-player";
import { VideoSettings } from "./video-settings";
import type { PlayerConfig } from "@/types/player-config";

interface VideoPlayerViewProps {
  videoId: string;
  playbackUrl: string;
  title: string;
  initialConfig: PlayerConfig;
}

export function VideoPlayerView({
  videoId,
  playbackUrl,
  title,
  initialConfig,
}: VideoPlayerViewProps) {
  const [config, setConfig] = useState<PlayerConfig>(initialConfig);

  const handleConfigChange = (updatedConfig: PlayerConfig) => {
    setConfig(updatedConfig);
  };

  return (
    <div className="space-y-6">
      {/* WatchMap Custom Player */}
      <div className="w-full flex justify-center">
        <WatchMapPlayer
          src={playbackUrl}
          videoId={videoId}
          title={title}
          config={config}
        />
      </div>

      {/* Video Settings */}
      <VideoSettings
        videoId={videoId}
        config={config}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}
