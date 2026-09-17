"use client";

import * as React from "react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Download, Pencil, Trash2, FolderInput } from "lucide-react";
import { EditVideoDialog } from "./edit-video-dialog";
import { DeleteVideoDialog } from "./delete-video-dialog";
import { MoveVideoDialog } from "./move-video-dialog";
import { useRouter } from "next/navigation";
import type { Video } from "@/db/schema";

interface VideoCardMenuProps {
  video: Video;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onMove?: () => void;
}

export function VideoCardMenu({
  video,
  onEdit,
  onDelete,
  onDownload,
  onMove,
}: VideoCardMenuProps) {
  const [localEditOpen, setLocalEditOpen] = useState(false);
  const [localDeleteOpen, setLocalDeleteOpen] = useState(false);
  const [localMoveOpen, setLocalMoveOpen] = useState(false);
  const router = useRouter();

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit();
    } else {
      setLocalEditOpen(true);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete();
    } else {
      setLocalDeleteOpen(true);
    }
  };

  const handleMoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMove) {
      onMove();
    } else {
      setLocalMoveOpen(true);
    }
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDownload?.();
  };

  return (
    <>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Ações para ${video.title}`}
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
              onClick={handleDownloadClick}
              className="gap-2 text-xs"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span>Baixar</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleEditClick}
              className="gap-2 text-xs"
            >
              <Pencil className="size-3.5 text-muted-foreground" />
              <span>Editar</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleMoveClick}
              className="gap-2 text-xs"
            >
              <FolderInput className="size-3.5 text-muted-foreground" />
              <span>Mover para pasta</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleDeleteClick}
              className="gap-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="size-3.5" />
              <span>Excluir</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!onEdit && (
        <EditVideoDialog
          video={video}
          open={localEditOpen}
          onOpenChange={setLocalEditOpen}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {!onMove && (
        <MoveVideoDialog
          video={video}
          open={localMoveOpen}
          onOpenChange={setLocalMoveOpen}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {!onDelete && (
        <DeleteVideoDialog
          video={video}
          open={localDeleteOpen}
          onOpenChange={setLocalDeleteOpen}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </>
  );
}

