"use client";

import * as React from "react";
import { useState } from "react";
import { VideoPageHeader } from "./video-page-header";
import { VideoPlayerView } from "./video-player-view";
import type { Video } from "@/db/schema";
import type { PlayerConfig } from "@/types/player-config";

interface VideoDetailsViewProps {
  video: Video;
  accountName: string;
  playbackUrl: string;
  initialConfig: PlayerConfig;
  cdnUrl: string;
}

export function VideoDetailsView({
  video,
  accountName,
  playbackUrl,
  initialConfig,
  cdnUrl,
}: VideoDetailsViewProps) {
  const [currentTitle, setCurrentTitle] = useState(video.title);

  return (
    <div className="space-y-6">
      <VideoPageHeader
        video={video}
        accountName={accountName}
        onTitleChange={setCurrentTitle}
      />

      <VideoPlayerView
        videoId={video.id}
        playbackUrl={playbackUrl}
        title={currentTitle}
        initialConfig={initialConfig}
        publicId={video.publicId}
        cdnUrl={cdnUrl}
      />
    </div>
  );
}
