"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { FolderPlus, UploadCloud } from "lucide-react";
import type { ContextMenuPosition } from "./video-context-menu";
import { cn } from "@/lib/utils";

export interface LibraryContextMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  separator?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}

export interface LibraryContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
  items?: LibraryContextMenuItem[];
  onNewFolder?: () => void;
  onUploadVideo?: () => void;
}

export function LibraryContextMenu({
  position,
  onClose,
  items,
  onNewFolder,
  onUploadVideo,
}: LibraryContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;

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
  }, [position, onClose]);

  if (!position) return null;

  // Build menu action items (extensible structure)
  const menuItems: LibraryContextMenuItem[] = items ?? [
    {
      id: "new-folder",
      label: "Nova pasta",
      icon: FolderPlus,
      action: () => onNewFolder?.(),
    },
    {
      id: "upload-video",
      label: "Enviar vídeo",
      icon: UploadCloud,
      action: () => onUploadVideo?.(),
    },
  ];

  // Viewport clamping
  const menuWidth = 176;
  const estimatedItemHeight = 32;
  const menuHeight = menuItems.length * estimatedItemHeight + 16;
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
      aria-label="Ações da Biblioteca"
      onClick={(e) => {
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {menuItems.map((item, index) => {
        const IconComponent = item.icon;
        return (
          <React.Fragment key={item.id}>
            {item.separator && index > 0 && (
              <div className="-mx-1 my-1 h-px bg-border/60" role="separator" />
            )}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                onClose();
                item.action();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer text-left outline-none",
                item.destructive
                  ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                  : "text-foreground hover:bg-muted focus:bg-muted",
                item.disabled && "opacity-50 pointer-events-none cursor-not-allowed"
              )}
            >
              <IconComponent
                className={cn(
                  "size-3.5",
                  item.destructive ? "text-destructive" : "text-muted-foreground"
                )}
              />
              <span>{item.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
