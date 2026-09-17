"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { VideoCard } from "./video-card";
import { VideoContextMenu, type ContextMenuPosition } from "./video-context-menu";
import { EditVideoDialog } from "./edit-video-dialog";
import { DeleteVideoDialog } from "./delete-video-dialog";
import { UploadButton } from "./upload-button";
import { useToast } from "@/components/ui/toast";
import {
  Search,
  X,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Video as VideoIcon,
  SearchX,
} from "lucide-react";
import type { Video } from "@/db/schema";

type StatusFilter = "all" | "ready" | "processing" | "errored";
type SortOption = "newest" | "oldest" | "title";

const statusLabels: Record<StatusFilter, string> = {
  all: "Todos",
  ready: "Prontos",
  processing: "Processando",
  errored: "Com erro",
};

const sortLabels: Record<SortOption, string> = {
  newest: "Mais recentes",
  oldest: "Mais antigos",
  title: "Nome (A-Z)",
};

interface VideosLibraryProps {
  videos: Video[];
  videoPlaysMap: Record<string, number>;
}

export function VideosLibrary({ videos, videoPlaysMap }: VideosLibraryProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ── Filter and Sort State ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // ── Context Menu State ──
  const [contextMenuVideo, setContextMenuVideo] = useState<Video | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);

  // ── Dialog States ──
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);

  // ── Filter and Sort Logic ──
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Text search (Title & Filename)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.originalFilename && v.originalFilename.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === "ready") {
      result = result.filter((v) => v.status === "ready");
    } else if (statusFilter === "processing") {
      result = result.filter(
        (v) =>
          v.status === "processing" ||
          v.status === "waiting_upload" ||
          v.status === "uploading"
      );
    } else if (statusFilter === "errored") {
      result = result.filter((v) => v.status === "errored");
    }

    // Sorting
    if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } else if (sortBy === "title") {
      result.sort((a, b) =>
        a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" })
      );
    }

    return result;
  }, [videos, searchQuery, statusFilter, sortBy]);

  // ── Context Menu Handlers ──
  const handleOpenContextMenu = useCallback((e: React.MouseEvent, video: Video) => {
    setContextMenuVideo(video);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuVideo(null);
    setContextMenuPosition(null);
  }, []);

  // ── Action Handlers ──
  const handleEdit = useCallback((video: Video) => {
    setEditingVideo(video);
  }, []);

  const handleDelete = useCallback((video: Video) => {
    setDeletingVideo(video);
  }, []);

  const handleDownload = useCallback((video: Video) => {
    if (video.status !== "ready") {
      toast("O vídeo ainda está sendo processado.", "info");
      return;
    }
    // Respects spec: does not fabricate fake download if static renditions are not available
    toast("Download direto não disponível para este vídeo.", "info");
  }, [toast]);

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "all";

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      {videos.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 rounded-xl border border-border bg-card/60 shadow-2xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar por título ou arquivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-8 text-xs bg-white dark:bg-zinc-900 border-border shadow-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Limpar busca"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filters & Sort Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs font-medium text-foreground bg-white dark:bg-zinc-900 border-border shadow-2xs hover:bg-muted/50 cursor-pointer"
                  >
                    <Filter className="size-3.5 text-muted-foreground" />
                    <span>Status: {statusLabels[statusFilter]}</span>
                    <ChevronDown className="size-3 text-muted-foreground ml-0.5 opacity-70" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-36">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  Todos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("ready")}>
                  Prontos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("processing")}>
                  Processando
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("errored")}>
                  Com erro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort Order */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs font-medium text-foreground bg-white dark:bg-zinc-900 border-border shadow-2xs hover:bg-muted/50 cursor-pointer"
                  >
                    <ArrowUpDown className="size-3.5 text-muted-foreground" />
                    <span>{sortLabels[sortBy]}</span>
                    <ChevronDown className="size-3 text-muted-foreground ml-0.5 opacity-70" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setSortBy("newest")}>
                  Mais recentes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("oldest")}>
                  Mais antigos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("title")}>
                  Nome (A-Z)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Total Indicator */}
            <div className="hidden md:flex items-center pl-2 pr-4 text-xs font-medium text-muted-foreground">
              {filteredVideos.length === 1
                ? "1 vídeo"
                : `${filteredVideos.length} vídeos`}
            </div>
          </div>
        </div>
      )}

      {/* ── Content View ── */}
      {videos.length === 0 ? (
        /* ── Empty Library State ── */
        <div className="rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex flex-col items-center justify-center gap-4 py-14 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft border border-primary/20 text-primary shadow-xs">
              <VideoIcon className="size-6" />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <h3 className="text-sm font-semibold text-foreground">
                Nenhum vídeo ainda
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Envie seu primeiro vídeo para começar a configurar o player e
                acompanhar seus dados.
              </p>
            </div>
            <UploadButton
              variant="outline"
              size="sm"
              className="cursor-pointer shadow-2xs"
            />
          </div>
        </div>
      ) : filteredVideos.length === 0 ? (
        /* ── Search / Filter No Results State ── */
        <div className="rounded-xl border border-border bg-card shadow-2xs">
          <div className="flex flex-col items-center justify-center gap-3.5 py-12 px-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted border border-border text-muted-foreground">
              <SearchX className="size-5" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-semibold text-foreground">
                Nenhum vídeo encontrado
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Não encontramos vídeos correspondentes aos termos ou filtros
                aplicados.
              </p>
            </div>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="h-8 px-3 text-xs font-medium cursor-pointer shadow-2xs"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* ── Videos List ── */
        <div className="space-y-2.5">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              playsCount={videoPlaysMap[video.id] ?? 0}
              onContextMenu={handleOpenContextMenu}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* ── Context Menu (Right Click on Cards) ── */}
      <VideoContextMenu
        video={contextMenuVideo}
        position={contextMenuPosition}
        onClose={handleCloseContextMenu}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDownload={handleDownload}
      />

      {/* ── Shared Edit Video Dialog ── */}
      {editingVideo && (
        <EditVideoDialog
          video={editingVideo}
          open={!!editingVideo}
          onOpenChange={(open) => {
            if (!open) setEditingVideo(null);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* ── Shared Delete Video Dialog ── */}
      {deletingVideo && (
        <DeleteVideoDialog
          video={deletingVideo}
          open={!!deletingVideo}
          onOpenChange={(open) => {
            if (!open) setDeletingVideo(null);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      <style>{`
        @keyframes wm-table-shimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
