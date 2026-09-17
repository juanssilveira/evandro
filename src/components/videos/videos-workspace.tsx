"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { UploadDialog } from "@/components/videos/upload-dialog";
import { UploadCloud, Plus } from "lucide-react";

interface VideosWorkspaceContextType {
  openNewVideoModal: (file?: File | null) => void;
}

const VideosWorkspaceContext = createContext<VideosWorkspaceContextType | null>(null);

export function useVideosWorkspace() {
  const context = useContext(VideosWorkspaceContext);
  if (!context) {
    throw new Error("useVideosWorkspace must be used within a VideosWorkspace");
  }
  return context;
}

interface VideosWorkspaceProps {
  children: React.ReactNode;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

function isValidVideoFile(file: File): boolean {
  if (file.type && file.type.startsWith("video/")) {
    return true;
  }
  const ext = file.name.toLowerCase();
  return (
    ext.endsWith(".mp4") ||
    ext.endsWith(".mov") ||
    ext.endsWith(".webm") ||
    ext.endsWith(".m4v")
  );
}

export function VideosWorkspace({ children }: VideosWorkspaceProps) {
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFile, setModalFile] = useState<File | null>(null);

  // Drag & drop state
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Open modal handler (unified for Header, Empty State, Context Menu, and Drop)
  const openNewVideoModal = useCallback((file?: File | null) => {
    setContextMenu(null);
    setModalFile(file || null);
    setIsModalOpen(true);
  }, []);

  const handleModalOpenChange = useCallback((open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setModalFile(null);
    }
  }, []);

  // ── Context Menu handlers ──
  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    e.preventDefault();

    // Clamp coordinates to viewport boundaries so the menu doesn't clip
    const menuWidth = 170;
    const menuHeight = 50;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

    setContextMenu({ x, y });
  };

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
      }
    };

    const handleScroll = () => {
      closeContextMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [contextMenu, closeContextMenu]);

  // ── Drag & Drop handlers (Flicker-free whole-page detection) ──
  const handleDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer && e.dataTransfer.types.includes("Files")) {
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDraggingFile(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.dataTransfer && e.dataTransfer.types.includes("Files")) {
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingFile(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer && e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const validVideo = files.find(isValidVideoFile);

      if (validVideo) {
        openNewVideoModal(validVideo);
      }
    }
  };

  return (
    <VideosWorkspaceContext.Provider value={{ openNewVideoModal }}>
      <div
        onContextMenu={handleContextMenu}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative flex-1 flex flex-col"
      >
        {children}

        {/* ── Drag & Drop Visual Overlay (Discreet & Elegant) ── */}
        {isDraggingFile && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/85 backdrop-blur-xs pointer-events-none animate-in fade-in-0 duration-150"
          >
            <div className="flex flex-col items-center justify-center gap-3 p-8 sm:p-12 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 text-center max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <UploadCloud className="size-7" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold tracking-tight text-foreground">
                  Solte para enviar o vídeo
                </p>
                <p className="text-xs text-muted-foreground">
                  O arquivo será aberto no modal de envio
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Custom Right-Click Context Menu ── */}
        {contextMenu && (
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            className="z-50 min-w-[160px] rounded-lg border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100 select-none"
            role="menu"
            aria-label="Opções da página"
          >
            <button
              type="button"
              onClick={() => openNewVideoModal()}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer text-left focus:outline-none focus:bg-accent"
              role="menuitem"
            >
              <Plus className="size-4 text-primary shrink-0" />
              <span>Novo vídeo</span>
            </button>
          </div>
        )}

        {/* ── Unified Single Modal ── */}
        <UploadDialog
          open={isModalOpen}
          onOpenChange={handleModalOpenChange}
          initialFile={modalFile}
        />
      </div>
    </VideosWorkspaceContext.Provider>
  );
}
