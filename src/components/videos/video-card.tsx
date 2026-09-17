"use client";

import * as React from "react";
import Link from "next/link";
import { Video as VideoIcon, Loader2, AlertCircle, PlayCircle, Calendar, HardDrive } from "lucide-react";
import { VideoCardMenu } from "./video-card-menu";
import { cn } from "@/lib/utils";
import type { Video } from "@/db/schema";

interface VideoCardProps {
  video: Video;
  playsCount: number;
  onContextMenu: (e: React.MouseEvent, video: Video) => void;
  onEdit: (video: Video) => void;
  onDelete: (video: Video) => void;
  onDownload: (video: Video) => void;
  onMove?: (video: Video) => void;
}

function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "--:--";
  }
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(d);
}

export function VideoCard({
  video,
  playsCount,
  onContextMenu,
  onEdit,
  onDelete,
  onDownload,
  onMove,
}: VideoCardProps) {
  const isReady = video.status === "ready";
  const isProcessing =
    video.status === "processing" ||
    video.status === "waiting_upload" ||
    video.status === "uploading";
  const isErrored = video.status === "errored";

  const durationStr = formatDuration(video.duration);
  const playsLabel =
    playsCount === 1
      ? "1 Play"
      : `${playsCount.toLocaleString("pt-BR")} Plays`;

  const posterUrl =
    isReady && video.muxPlaybackId
      ? `https://image.mux.com/${video.muxPlaybackId}/thumbnail.webp?width=480&height=270&fit_mode=smartcrop`
      : null;

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, video);
      }}
      className={cn(
        "group relative flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-4 p-3 sm:p-3.5 rounded-xl border border-border bg-card transition-all duration-150 overflow-hidden",
        isReady &&
          "hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs cursor-pointer",
        isProcessing &&
          "bg-muted/15 cursor-not-allowed opacity-90 select-none",
        isErrored && "bg-destructive/5 border-destructive/20"
      )}
      title={
        isProcessing
          ? "Vídeo em processamento no Mux. A página será liberada assim que concluir."
          : isErrored && video.errorMessage
          ? video.errorMessage
          : undefined
      }
    >
      {/* Shimmer sweep effect during processing */}
      {isProcessing && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <div
            className="h-full w-[200%] absolute top-0 -left-full bg-gradient-to-r from-transparent via-amber-500/10 dark:via-amber-400/10 to-transparent"
            style={{
              animation:
                "wm-table-shimmer 2.2s infinite cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
      )}

      {/* Stretched Link for Primary Navigation on Ready Videos */}
      {isReady && (
        <Link
          href={`/videos/${video.id}`}
          className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
          aria-label={`Abrir vídeo ${video.title}`}
        />
      )}

      {/* ── Thumbnail / Poster ── */}
      <div className="relative w-full sm:w-40 sm:min-w-40 aspect-video rounded-lg overflow-hidden bg-muted/40 border border-border/70 shrink-0 flex items-center justify-center z-10 pointer-events-none">
        {posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={posterUrl}
            alt={video.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : isProcessing ? (
          <div className="flex flex-col items-center justify-center gap-1.5 text-amber-500">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-[10px] font-medium">Processando</span>
          </div>
        ) : isErrored ? (
          <div className="flex flex-col items-center justify-center gap-1 text-destructive">
            <AlertCircle className="size-5" />
            <span className="text-[10px] font-medium">Falha</span>
          </div>
        ) : (
          <VideoIcon className="size-5 text-muted-foreground/60" />
        )}

        {/* Duration badge overlaid on thumbnail */}
        {isReady && video.duration && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono font-medium leading-none tracking-tight">
            {durationStr}
          </div>
        )}
      </div>

      {/* ── Main Information Area ── */}
      <div className="flex-1 min-w-0 space-y-1 z-10 pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={cn(
              "text-sm font-semibold tracking-tight transition-colors truncate max-w-full",
              isReady && "text-foreground group-hover:text-primary",
              isProcessing && "text-muted-foreground",
              isErrored && "text-foreground"
            )}
            title={video.title}
          >
            {video.title}
          </p>

          {/* Status Badges */}
          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
              <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
              Processando
            </span>
          )}
          {isErrored && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
              <AlertCircle className="size-2.5" />
              {video.errorMessage || "Erro"}
            </span>
          )}
        </div>

        {/* Original filename */}
        <p
          className="text-xs font-mono text-muted-foreground truncate"
          title={video.originalFilename}
        >
          {video.originalFilename}
        </p>

        {/* Metadata items row */}
        <div className="flex items-center gap-3 pt-0.5 text-xs text-muted-foreground font-mono flex-wrap">
          <span className="flex items-center gap-1">
            <HardDrive className="size-3 shrink-0 text-muted-foreground/70" />
            {formatBytes(video.sizeBytes)}
          </span>

          <span className="text-border" aria-hidden="true">
            ·
          </span>

          <span suppressHydrationWarning className="flex items-center gap-1">
            <Calendar className="size-3 shrink-0 text-muted-foreground/70" />
            {formatDate(video.createdAt)}
          </span>
        </div>
      </div>

      {/* ── Plays Indicator ── */}
      <div className="flex items-center z-10 pointer-events-none shrink-0 sm:self-center">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold font-mono text-muted-foreground bg-muted/40 border border-border/70">
          <PlayCircle className="size-3.5 text-muted-foreground/80 shrink-0" />
          {playsLabel}
        </span>
      </div>

      {/* ── 3-Dots Action Menu ── */}
      <div className="relative z-10 shrink-0 flex items-center justify-end">
        <VideoCardMenu
          video={video}
          onEdit={() => onEdit(video)}
          onDelete={() => onDelete(video)}
          onDownload={() => onDownload(video)}
          onMove={onMove ? () => onMove(video) : undefined}
        />
      </div>
    </div>
  );
}

