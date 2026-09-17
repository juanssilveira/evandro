"use client";

import * as React from "react";
import { FolderCard } from "./folder-card";
import type { FolderWithCount } from "@/lib/folders";
import { Folder as FolderIcon } from "lucide-react";

interface FoldersSectionProps {
  folders: FolderWithCount[];
}

export function FoldersSection({ folders }: FoldersSectionProps) {
  if (!folders || folders.length === 0) {
    return null;
  }

  return (
    <section aria-label="Pastas de vídeos" className="space-y-2.5">
      <div className="flex items-center gap-2">
        <FolderIcon className="size-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pastas ({folders.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
        {folders.map((folder) => (
          <FolderCard key={folder.id} folder={folder} />
        ))}
      </div>
    </section>
  );
}
