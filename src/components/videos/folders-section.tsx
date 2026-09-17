"use client";

import * as React from "react";
import { FolderCard } from "./folder-card";
import type { FolderWithCount } from "@/lib/folders";
import { Folder as FolderIcon } from "lucide-react";

interface FoldersSectionProps {
  folders: FolderWithCount[];
  onFolderContextMenu?: (e: React.MouseEvent, folder: FolderWithCount) => void;
  onRename?: (folder: FolderWithCount) => void;
  onChangeColor?: (folder: FolderWithCount) => void;
  onDelete?: (folder: FolderWithCount) => void;
  onDropVideo?: (videoId: string, folder: FolderWithCount) => void;
}

export function FoldersSection({
  folders,
  onFolderContextMenu,
  onRename,
  onChangeColor,
  onDelete,
  onDropVideo,
}: FoldersSectionProps) {
  if (!folders || folders.length === 0) {
    return null;
  }

  return (
    <section aria-label="Pastas de vídeos" className="space-y-3.5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-muted border border-border text-foreground/80 shrink-0">
          <FolderIcon className="size-3.5" />
        </div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            Pastas
          </h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-muted-foreground border border-border/60">
            {folders.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {folders.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            onContextMenu={onFolderContextMenu}
            onRename={onRename}
            onChangeColor={onChangeColor}
            onDelete={onDelete}
            onDropVideo={onDropVideo}
          />
        ))}
      </div>
    </section>
  );
}
