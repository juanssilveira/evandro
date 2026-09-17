"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EditFolderDialog } from "./edit-folder-dialog";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import { FOLDER_COLOR_CONFIGS } from "@/lib/folder-colors";
import type { FolderColor } from "@/db/schema/folders";
import type { FolderWithCount } from "@/lib/folders";
import { Folder as FolderIcon, MoreVertical, Pencil, Palette, Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderCardProps {
  folder: FolderWithCount;
  onContextMenu?: (e: React.MouseEvent, folder: FolderWithCount) => void;
  onRename?: (folder: FolderWithCount) => void;
  onChangeColor?: (folder: FolderWithCount) => void;
  onDelete?: (folder: FolderWithCount) => void;
  onDropVideo?: (videoId: string, folder: FolderWithCount) => void;
}

export function FolderCard({
  folder,
  onContextMenu,
  onRename,
  onChangeColor,
  onDelete,
  onDropVideo,
}: FolderCardProps) {
  const router = useRouter();
  const [localEditOpen, setLocalEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"rename" | "color">("rename");
  const [localDeleteOpen, setLocalDeleteOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const cfg =
    FOLDER_COLOR_CONFIGS[(folder.color as FolderColor) || "gray"] ||
    FOLDER_COLOR_CONFIGS.gray;

  const countLabel =
    folder.videoCount === 1 ? "1 vídeo" : `${folder.videoCount} vídeos`;

  const handleOpenFolder = () => {
    router.push(`/videos/folders/${folder.id}`);
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRename) {
      onRename(folder);
    } else {
      setEditMode("rename");
      setLocalEditOpen(true);
    }
  };

  const handleChangeColorClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onChangeColor) {
      onChangeColor(folder);
    } else {
      setEditMode("color");
      setLocalEditOpen(true);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(folder);
    } else {
      setLocalDeleteOpen(true);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    if (
      e.dataTransfer &&
      (e.dataTransfer.types.includes("application/x-watchmap-video") ||
        e.dataTransfer.types.includes("text/plain"))
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (!isDragOver) {
        setIsDragOver(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const videoId =
      e.dataTransfer.getData("application/x-watchmap-video") ||
      e.dataTransfer.getData("text/plain");

    if (videoId && onDropVideo) {
      onDropVideo(videoId, folder);
    }
  };

  return (
    <>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e, folder);
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "group relative flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card transition-all duration-150 select-none",
          isDragOver
            ? "ring-2 ring-primary ring-offset-1 border-primary bg-primary/5 dark:bg-primary/10 scale-[1.02] shadow-md z-20"
            : "hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs active:scale-[0.99]"
        )}
      >
        {/* Stretched Link to folder view */}
        <Link
          href={`/videos/folders/${folder.id}`}
          draggable={false}
          className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 rounded-xl"
          aria-label={`Abrir pasta ${folder.name}`}
        />

        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 min-w-0 z-10 pointer-events-none">
          <div
            className={cn(
              "flex size-9 sm:size-10 items-center justify-center rounded-lg border shrink-0 transition-transform duration-150",
              isDragOver ? "scale-110" : "group-hover:scale-105",
              cfg.iconClass
            )}
          >
            <FolderIcon className="size-4.5 sm:size-5 fill-current/20" />
          </div>

          <div className="min-w-0 space-y-0.5">
            <p
              className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[170px] xs:max-w-[220px] sm:max-w-[260px]"
              title={folder.name}
            >
              {folder.name}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground">
              {isDragOver ? (
                <span className="text-primary font-medium animate-pulse">
                  Solte para mover vídeo
                </span>
              ) : (
                countLabel
              )}
            </p>
          </div>
        </div>

        {/* Right: Actions Dropdown (Share exact same options as Context Menu) */}
        <div className="relative z-10 shrink-0 flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Ações para pasta ${folder.name}`}
                  className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              }
            >
              <MoreVertical className="size-3.5" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenFolder();
                }}
                className="gap-2 text-xs cursor-pointer"
              >
                <FolderOpen className="size-3.5 text-muted-foreground" />
                <span>Abrir</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleRenameClick}
                className="gap-2 text-xs cursor-pointer"
              >
                <Pencil className="size-3.5 text-muted-foreground" />
                <span>Renomear</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleChangeColorClick}
                className="gap-2 text-xs cursor-pointer"
              >
                <Palette className="size-3.5 text-muted-foreground" />
                <span>Alterar cor</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleDeleteClick}
                className="gap-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Excluir pasta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Local Fallback Dialogs if not controlled by parent */}
      {!onRename && (
        <EditFolderDialog
          folder={folder}
          open={localEditOpen}
          onOpenChange={setLocalEditOpen}
          initialMode={editMode}
        />
      )}

      {!onDelete && (
        <DeleteFolderDialog
          folder={folder}
          open={localDeleteOpen}
          onOpenChange={setLocalDeleteOpen}
        />
      )}
    </>
  );
}
