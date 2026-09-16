"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Film, HardDrive, Calendar } from "lucide-react";
import { VideoIdBadge } from "./video-id-badge";
import { VideoHeaderActions } from "./video-header-actions";
import type { Video } from "@/db/schema";

interface VideoPageHeaderProps {
  video: Video;
  accountName: string;
  onTitleChange?: (newTitle: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function VideoPageHeader({
  video,
  // accountName is kept in props interface for API compatibility but not displayed per spec 015
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  accountName: _accountName,
  onTitleChange,
}: VideoPageHeaderProps) {
  const [title, setTitle] = useState(video.title);

  const handleTitleUpdated = (newTitle: string) => {
    setTitle(newTitle);
    onTitleChange?.(newTitle);
  };

  return (
    <div className="space-y-3 pb-4 border-b border-border/70">
      {/* Top Bar: Back Link & Public ID Badge */}
      <div className="flex items-center justify-between">
        <Link
          href="/videos"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Voltar para biblioteca</span>
        </Link>

        <VideoIdBadge publicId={video.publicId} />
      </div>

      {/* Title */}
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate" title={title}>
        {title}
      </h1>

      {/* Metadata Strip & Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
        {/* Technical Metadata Strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-1.5 truncate max-w-xs sm:max-w-md">
            <Film className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate font-mono text-[11px]" title={video.originalFilename}>
              {video.originalFilename}
            </span>
          </div>

          <span className="text-border hidden sm:inline">•</span>

          <div className="flex items-center gap-1.5">
            <HardDrive className="size-3.5 text-muted-foreground shrink-0" />
            <span>{formatBytes(video.sizeBytes)}</span>
          </div>

          <span className="text-border hidden sm:inline">•</span>

          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground shrink-0" />
            <span>{formatDate(video.createdAt)}</span>
          </div>


        </div>

        {/* Action Buttons aligned with metadata */}
        <VideoHeaderActions
          video={video}
          onTitleUpdated={handleTitleUpdated}
        />
      </div>
    </div>
  );
}
