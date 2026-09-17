"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { FolderOpen, Pencil, Palette, Trash2 } from "lucide-react";
import type { FolderWithCount } from "@/lib/folders";
import type { ContextMenuPosition } from "./video-context-menu";

interface FolderContextMenuProps {
  folder: FolderWithCount | null;
  position: ContextMenuPosition | null;
  onClose: () => void;
  onOpenFolder: (folder: FolderWithCount) => void;
  onRename: (folder: FolderWithCount) => void;
  onChangeColor: (folder: FolderWithCount) => void;
  onDelete: (folder: FolderWithCount) => void;
}

export function FolderContextMenu({
  folder,
  position,
  onClose,
  onOpenFolder,
  onRename,
  onChangeColor,
  onDelete,
}: FolderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position || !folder) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleScrollOrResize = () => {
      onClose();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [position, folder, onClose]);

  if (!position || !folder) return null;

  // Viewport clamping
  const menuWidth = 176;
  const menuHeight = 160;
  const clampedX = Math.max(8, Math.min(position.x, window.innerWidth - menuWidth - 8));
  const clampedY = Math.max(8, Math.min(position.y, window.innerHeight - menuHeight - 8));

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: `${clampedX}px`,
        top: `${clampedY}px`,
      }}
      className="z-50 min-w-[176px] overflow-hidden rounded-xl border border-border bg-card p-1 text-card-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 select-none"
      role="menu"
      aria-label={`Ações para a pasta ${folder.name}`}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onOpenFolder(folder);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted transition-colors cursor-pointer text-left outline-none"
      >
        <FolderOpen className="size-3.5 text-muted-foreground" />
        <span>Abrir</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onRename(folder);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted transition-colors cursor-pointer text-left outline-none"
      >
        <Pencil className="size-3.5 text-muted-foreground" />
        <span>Renomear</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onChangeColor(folder);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted transition-colors cursor-pointer text-left outline-none"
      >
        <Palette className="size-3.5 text-muted-foreground" />
        <span>Alterar cor</span>
      </button>

      <div className="-mx-1 my-1 h-px bg-border/60" role="separator" />

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onDelete(folder);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus:bg-destructive/10 transition-colors cursor-pointer text-left outline-none"
      >
        <Trash2 className="size-3.5" />
        <span>Excluir</span>
      </button>
    </div>
  );
}
