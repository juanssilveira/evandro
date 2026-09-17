"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
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
import { Folder as FolderIcon, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderCardProps {
  folder: FolderWithCount;
}

export function FolderCard({ folder }: FolderCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cfg =
    FOLDER_COLOR_CONFIGS[(folder.color as FolderColor) || "gray"] ||
    FOLDER_COLOR_CONFIGS.gray;

  const countLabel =
    folder.videoCount === 1 ? "1 vídeo" : `${folder.videoCount} vídeos`;

  return (
    <>
      <div className="group relative flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs transition-all duration-150">
        {/* Stretched Link to folder view */}
        <Link
          href={`/videos/folders/${folder.id}`}
          className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 rounded-xl"
          aria-label={`Abrir pasta ${folder.name}`}
        />

        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 min-w-0 z-10 pointer-events-none">
          <div
            className={cn(
              "flex size-9 sm:size-10 items-center justify-center rounded-lg border shrink-0 transition-transform duration-150 group-hover:scale-105",
              cfg.iconClass
            )}
          >
            <FolderIcon className="size-4.5 sm:size-5 fill-current/20" />
          </div>

          <div className="min-w-0 space-y-0.5">
            <p
              className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[180px] xs:max-w-[240px] sm:max-w-[280px]"
              title={folder.name}
            >
              {folder.name}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground">
              {countLabel}
            </p>
          </div>
        </div>

        {/* Right: Actions Dropdown */}
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

            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditOpen(true);
                }}
                className="gap-2 text-xs cursor-pointer"
              >
                <Pencil className="size-3.5 text-muted-foreground" />
                <span>Editar pasta</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOpen(true);
                }}
                className="gap-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Excluir pasta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditFolderDialog
        folder={folder}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Delete Dialog */}
      <DeleteFolderDialog
        folder={folder}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
