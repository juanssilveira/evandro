"use client";

import * as React from "react";
import { useState } from "react";
import { VideoPageHeader } from "./video-page-header";
import { VideoPlayerView } from "./video-player-view";
import type { Video, Folder } from "@/db/schema";
import type { PlayerConfig } from "@/types/player-config";

interface VideoDetailsViewProps {
  video: Video;
  folder?: Folder | null;
  accountName: string;
  playbackUrl?: string;
  posterUrl?: string | null;
  backgroundPreviewUrl?: string | null;
  initialConfig: PlayerConfig;
  cdnUrl: string;
  defaultTab?: "appearance" | "playback" | "controls";
}

export function VideoDetailsView({
  video,
  folder,
  accountName,
  playbackUrl,
  posterUrl,
  backgroundPreviewUrl,
  initialConfig,
  cdnUrl,
  defaultTab,
}: VideoDetailsViewProps) {
  const [currentTitle, setCurrentTitle] = useState(video.title);

  return (
    <div className="space-y-6">
      <VideoPageHeader
        video={video}
        folder={folder}
        accountName={accountName}
        onTitleChange={setCurrentTitle}
      />


      <VideoPlayerView
        videoId={video.id}
        playbackUrl={playbackUrl}
        posterUrl={posterUrl}
        backgroundPreviewUrl={backgroundPreviewUrl}
        title={currentTitle}
        initialConfig={initialConfig}
        publicId={video.publicId}
        cdnUrl={cdnUrl}
        defaultTab={defaultTab}
      />
    </div>
  );
}
