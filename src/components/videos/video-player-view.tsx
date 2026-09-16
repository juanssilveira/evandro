"use client";

import { useState } from "react";
import { WatchMapPlayer } from "@/components/player/watchmap-player";
import { VideoSettings } from "./video-settings";

interface VideoPlayerViewProps {
  videoId: string;
  playbackUrl: string;
  title: string;
  initialDebugEnabled: boolean;
}

export function VideoPlayerView({
  videoId,
  playbackUrl,
  title,
  initialDebugEnabled,
}: VideoPlayerViewProps) {
  const [debugEnabled, setDebugEnabled] = useState(initialDebugEnabled);

  return (
    <div className="space-y-6">
      {/* WatchMap Custom Player */}
      <div className="w-full">
        <WatchMapPlayer
          src={playbackUrl}
          videoId={videoId}
          title={title}
          debugEnabled={debugEnabled}
        />
      </div>

      {/* Video Settings */}
      <VideoSettings
        videoId={videoId}
        debugEnabled={debugEnabled}
        onDebugChange={setDebugEnabled}
      />
    </div>
  );
}
