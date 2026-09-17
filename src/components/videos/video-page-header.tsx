"use client";

import * as React from "react";
import { useState } from "react";
import { Film, HardDrive, Calendar } from "lucide-react";
import { VideoIdBadge } from "./video-id-badge";
import { VideoHeaderActions } from "./video-header-actions";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import type { Video, Folder } from "@/db/schema";

interface VideoPageHeaderProps {
  video: Video;
  accountName: string;
  folder?: Folder | null;
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
  folder,
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

  const breadcrumbItems = [
    { label: "Biblioteca", href: "/videos" },
    ...(folder
      ? [{ label: folder.name, href: `/videos/folders/${folder.id}` }]
      : []),
    { label: title, isCurrent: true },
  ];

  return (
    <div className="space-y-3 pb-4 border-b border-border/70">
      {/* Top Bar: Breadcrumb Navigation & Public ID Badge */}
      <div className="flex items-center justify-between gap-4">
        <Breadcrumbs items={breadcrumbItems} />

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
            <span suppressHydrationWarning>{formatDate(video.createdAt)}</span>
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
