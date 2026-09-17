"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { FolderContextMenu } from "./folder-context-menu";
import { EditVideoDialog } from "./edit-video-dialog";
import { DeleteVideoDialog } from "./delete-video-dialog";
import { MoveVideoDialog } from "./move-video-dialog";
import { EditFolderDialog } from "./edit-folder-dialog";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import { FoldersSection } from "./folders-section";
import { UploadButton } from "./upload-button";
import { useToast } from "@/components/ui/toast";
import { moveVideoToFolderAction } from "@/app/actions/folders";
import { FOLDER_COLOR_CONFIGS } from "@/lib/folder-colors";
import {
  Search,
  X,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Video as VideoIcon,
  Folder as FolderIcon,
  SearchX,
  ArrowLeft,
  Check,
} from "lucide-react";
import type { Video } from "@/db/schema";
import type { Folder, FolderColor } from "@/db/schema/folders";
import type { FolderWithCount } from "@/lib/folders";
import { cn } from "@/lib/utils";

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

const DEFAULT_FOLDERS: FolderWithCount[] = [];

interface VideosLibraryProps {
  videos: Video[];
  videoPlaysMap: Record<string, number>;
  folders?: FolderWithCount[];
  currentFolder?: Folder | null;
}

export function VideosLibrary({
  videos: initialVideos,
  videoPlaysMap,
  folders: initialFolders = DEFAULT_FOLDERS,
  currentFolder = null,
}: VideosLibraryProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Local state for optimistic UI updates
  const [localVideos, setLocalVideos] = useState<Video[]>(initialVideos);
  const [prevInitialVideos, setPrevInitialVideos] = useState<Video[]>(initialVideos);
  if (initialVideos !== prevInitialVideos) {
    setPrevInitialVideos(initialVideos);
    setLocalVideos(initialVideos);
  }

  const [localFolders, setLocalFolders] = useState<FolderWithCount[]>(initialFolders);
  const [prevInitialFolders, setPrevInitialFolders] = useState<FolderWithCount[]>(initialFolders);
  if (initialFolders !== prevInitialFolders) {
    setPrevInitialFolders(initialFolders);
    setLocalFolders(initialFolders);
  }

  // ── Filter and Sort State ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // ── Video Context Menu State ──
  const [contextMenuVideo, setContextMenuVideo] = useState<Video | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);

  // ── Folder Context Menu State ──
  const [contextMenuFolder, setContextMenuFolder] = useState<FolderWithCount | null>(null);
  const [folderContextMenuPosition, setFolderContextMenuPosition] = useState<ContextMenuPosition | null>(null);

  // ── Video Dialog States ──
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);
  const [movingVideo, setMovingVideo] = useState<Video | null>(null);

  // ── Folder Dialog States ──
  const [editingFolder, setEditingFolder] = useState<FolderWithCount | null>(null);
  const [editFolderMode, setEditFolderMode] = useState<"rename" | "color">("rename");
  const [deletingFolder, setDeletingFolder] = useState<FolderWithCount | null>(null);

  // ── Filter and Sort Logic ──
  const filteredVideos = useMemo(() => {
    let result = [...localVideos];

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
  }, [localVideos, searchQuery, statusFilter, sortBy]);

  // ── Video Context Menu Handlers ──
  const handleOpenContextMenu = useCallback((e: React.MouseEvent, video: Video) => {
    setContextMenuFolder(null);
    setFolderContextMenuPosition(null);
    setContextMenuVideo(video);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuVideo(null);
    setContextMenuPosition(null);
  }, []);

  // ── Folder Context Menu Handlers ──
  const handleOpenFolderContextMenu = useCallback((e: React.MouseEvent, folder: FolderWithCount) => {
    setContextMenuVideo(null);
    setContextMenuPosition(null);
    setContextMenuFolder(folder);
    setFolderContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseFolderContextMenu = useCallback(() => {
    setContextMenuFolder(null);
    setFolderContextMenuPosition(null);
  }, []);

  // ── Video Action Handlers ──
  const handleEditVideo = useCallback((video: Video) => {
    setEditingVideo(video);
  }, []);

  const handleDeleteVideo = useCallback((video: Video) => {
    setDeletingVideo(video);
  }, []);

  const handleMoveVideo = useCallback((video: Video) => {
    setMovingVideo(video);
  }, []);

  const handleDownloadVideo = useCallback((video: Video) => {
    if (video.status !== "ready") {
      toast("O vídeo ainda está sendo processado.", "info");
      return;
    }
    toast("Download direto não disponível para este vídeo.", "info");
  }, [toast]);

  // ── Folder Action Handlers ──
  const handleOpenFolder = useCallback((folder: FolderWithCount) => {
    router.push(`/videos/folders/${folder.id}`);
  }, [router]);

  const handleRenameFolder = useCallback((folder: FolderWithCount) => {
    setEditFolderMode("rename");
    setEditingFolder(folder);
  }, []);

  const handleChangeFolderColor = useCallback((folder: FolderWithCount) => {
    setEditFolderMode("color");
    setEditingFolder(folder);
  }, []);

  const handleDeleteFolder = useCallback((folder: FolderWithCount) => {
    setDeletingFolder(folder);
  }, []);

  const folderMap = useMemo(() => {
    const map = new Map<string, FolderWithCount>();
    for (const f of localFolders) {
      map.set(f.id, f);
    }
    return map;
  }, [localFolders]);

  // ── Drag & Drop Move Video to Folder Handler ──
  const handleDropVideoToFolder = useCallback(
    async (videoId: string, targetFolder: FolderWithCount) => {
      const targetVideo = localVideos.find((v) => v.id === videoId);
      if (!targetVideo) return;

      if (targetVideo.folderId === targetFolder.id) return;

      const previousVideos = [...localVideos];
      const previousFolders = [...localFolders];
      const videoSizeBytes = Number(targetVideo.sizeBytes) || 0;
      const videoPlays = videoPlaysMap[videoId] || 0;

      // Optimistic Update:
      // If inside a specific folder view, remove the video.
      // If in root library (all videos view), update the video's folderId.
      if (currentFolder) {
        setLocalVideos((prev) => prev.filter((v) => v.id !== videoId));
      } else {
        setLocalVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, folderId: targetFolder.id } : v
          )
        );
      }

      setLocalFolders((prev) =>
        prev.map((f) => {
          if (f.id === targetFolder.id) {
            return {
              ...f,
              videoCount: f.videoCount + 1,
              totalSizeBytes: (f.totalSizeBytes || 0) + videoSizeBytes,
              totalPlays: (f.totalPlays || 0) + videoPlays,
            };
          }
          if (targetVideo.folderId && f.id === targetVideo.folderId) {
            return {
              ...f,
              videoCount: Math.max(0, f.videoCount - 1),
              totalSizeBytes: Math.max(0, (f.totalSizeBytes || 0) - videoSizeBytes),
              totalPlays: Math.max(0, (f.totalPlays || 0) - videoPlays),
            };
          }
          return f;
        })
      );

      try {
        const res = await moveVideoToFolderAction({
          videoId,
          folderId: targetFolder.id,
        });

        if (res.error) {
          setLocalVideos(previousVideos);
          setLocalFolders(previousFolders);
          toast(res.error || "Não foi possível mover o vídeo.", "error");
          return;
        }

        toast(
          `Vídeo "${targetVideo.title}" movido para a pasta "${targetFolder.name}".`,
          "success"
        );
        router.refresh();
      } catch {
        setLocalVideos(previousVideos);
        setLocalFolders(previousFolders);
        toast("Erro ao mover o vídeo para a pasta.", "error");
      }
    },
    [localVideos, localFolders, videoPlaysMap, currentFolder, toast, router]
  );

  const hasActiveFilters =
    searchQuery.trim() !== "" || statusFilter !== "all" || sortBy !== "newest";

  const folderConfig = currentFolder
    ? FOLDER_COLOR_CONFIGS[(currentFolder.color as FolderColor) || "gray"] ||
      FOLDER_COLOR_CONFIGS.gray
    : null;

  return (
    <div className="space-y-7 sm:space-y-8">
      {/* ── Folders Section (Only on root library when folders exist) ── */}
      {!currentFolder && localFolders.length > 0 && (
        <FoldersSection
          folders={localFolders}
          onFolderContextMenu={handleOpenFolderContextMenu}
          onRename={handleRenameFolder}
          onChangeColor={handleChangeFolderColor}
          onDelete={handleDeleteFolder}
          onDropVideo={handleDropVideoToFolder}
        />
      )}

      {/* ── Videos Section ── */}
      <section aria-label="Lista de vídeos" className="space-y-3.5">
        {/* Section Header: only on root if folders exist */}
        {!currentFolder && localFolders.length > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted border border-border text-foreground/80 shrink-0">
              <VideoIcon className="size-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                Vídeos
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-muted-foreground border border-border/60">
                {localVideos.length}
              </span>
            </div>
          </div>
        )}

        {/* ── Toolbar ── */}
        {(localVideos.length > 0 || hasActiveFilters) && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-1 rounded-xl border border-border bg-card shadow-2xs">
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
                      className={cn(
                        "h-9 gap-1.5 text-xs font-medium text-foreground bg-white dark:bg-zinc-900 border-border shadow-2xs hover:bg-muted/50 cursor-pointer transition-colors",
                        statusFilter !== "all" &&
                          "border-primary/40 bg-primary/5 text-primary dark:bg-primary/10 font-semibold"
                      )}
                    >
                      <Filter
                        className={cn(
                          "size-3.5",
                          statusFilter !== "all"
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <span>Status: {statusLabels[statusFilter]}</span>
                      <ChevronDown className="size-3 text-muted-foreground ml-0.5 opacity-70" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-40">
                  {(["all", "ready", "processing", "errored"] as StatusFilter[]).map((key) => {
                    const isSelected = statusFilter === key;
                    return (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={cn(
                          "flex items-center justify-between gap-2 text-xs cursor-pointer",
                          isSelected && "font-semibold text-primary"
                        )}
                      >
                        <span>{statusLabels[key]}</span>
                        {isSelected && <Check className="size-3.5 text-primary stroke-[2.5]" />}
                      </DropdownMenuItem>
                    );
                  })}
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
                      className={cn(
                        "h-9 gap-1.5 text-xs font-medium text-foreground bg-white dark:bg-zinc-900 border-border shadow-2xs hover:bg-muted/50 cursor-pointer transition-colors",
                        sortBy !== "newest" &&
                          "border-primary/40 bg-primary/5 text-primary dark:bg-primary/10 font-semibold"
                      )}
                    >
                      <ArrowUpDown
                        className={cn(
                          "size-3.5",
                          sortBy !== "newest"
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <span>{sortLabels[sortBy]}</span>
                      <ChevronDown className="size-3 text-muted-foreground ml-0.5 opacity-70" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-44">
                  {(["newest", "oldest", "title"] as SortOption[]).map((key) => {
                    const isSelected = sortBy === key;
                    return (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setSortBy(key)}
                        className={cn(
                          "flex items-center justify-between gap-2 text-xs cursor-pointer",
                          isSelected && "font-semibold text-primary"
                        )}
                      >
                        <span>{sortLabels[key]}</span>
                        {isSelected && <Check className="size-3.5 text-primary stroke-[2.5]" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Limpar Filtros Button */}
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setSortBy("newest");
                  }}
                  className="h-9 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-colors"
                  title="Limpar todos os filtros e busca"
                >
                  <X className="size-3.5" />
                  <span>Limpar filtros</span>
                </Button>
              )}

              {/* Total Indicator */}
              <div className="hidden md:flex items-center pl-2 pr-3 text-xs font-mono text-muted-foreground">
                {filteredVideos.length === 1
                  ? "1 vídeo"
                  : `${filteredVideos.length} vídeos`}
              </div>
            </div>
          </div>
        )}

        {/* ── Content View ── */}
        <div className="pt-0.5">
          {localVideos.length === 0 ? (
            currentFolder ? (
              /* ── Empty Folder State ── */
              <div className="rounded-xl border border-border bg-card shadow-2xs">
                <div className="flex flex-col items-center justify-center gap-4 py-14 px-6 text-center">
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center rounded-xl border shadow-xs",
                      folderConfig?.iconClass
                    )}
                  >
                    <FolderIcon className="size-6 fill-current/20" />
                  </div>
                  <div className="space-y-1.5 max-w-xs">
                    <h3 className="text-sm font-semibold text-foreground">
                      Esta pasta ainda não possui vídeos.
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Envie vídeos diretamente para esta pasta ou mova vídeos existentes da sua Biblioteca.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Link
                      href="/videos"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/50 transition-colors shadow-2xs"
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>Voltar para Biblioteca</span>
                    </Link>
                    <UploadButton
                      size="sm"
                      className="cursor-pointer shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Completely Empty Library State ── */
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
            )
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
                      setSortBy("newest");
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
                  folder={!currentFolder && video.folderId ? folderMap.get(video.folderId) : undefined}
                  playsCount={videoPlaysMap[video.id] ?? 0}
                  onContextMenu={handleOpenContextMenu}
                  onEdit={handleEditVideo}
                  onDelete={handleDeleteVideo}
                  onDownload={handleDownloadVideo}
                  onMove={handleMoveVideo}
                  isDraggable={true}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Video Context Menu (Right Click on Video Cards) ── */}
      <VideoContextMenu
        video={contextMenuVideo}
        position={contextMenuPosition}
        onClose={handleCloseContextMenu}
        onEdit={handleEditVideo}
        onDelete={handleDeleteVideo}
        onDownload={handleDownloadVideo}
        onMove={handleMoveVideo}
      />

      {/* ── Folder Context Menu (Right Click on Folder Cards) ── */}
      <FolderContextMenu
        folder={contextMenuFolder}
        position={folderContextMenuPosition}
        onClose={handleCloseFolderContextMenu}
        onOpenFolder={handleOpenFolder}
        onRename={handleRenameFolder}
        onChangeColor={handleChangeFolderColor}
        onDelete={handleDeleteFolder}
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

      {/* ── Shared Move Video Dialog ── */}
      {movingVideo && (
        <MoveVideoDialog
          video={movingVideo}
          open={!!movingVideo}
          onOpenChange={(open) => {
            if (!open) setMovingVideo(null);
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

      {/* ── Shared Edit / Color Folder Dialog ── */}
      {editingFolder && (
        <EditFolderDialog
          folder={editingFolder}
          open={!!editingFolder}
          onOpenChange={(open) => {
            if (!open) setEditingFolder(null);
          }}
          initialMode={editFolderMode}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* ── Shared Delete Folder Dialog ── */}
      {deletingFolder && (
        <DeleteFolderDialog
          folder={deletingFolder}
          open={!!deletingFolder}
          onOpenChange={(open) => {
            if (!open) setDeletingFolder(null);
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
