"use client";

import * as React from "react";
import { useState, useRef, useCallback, createContext, useContext } from "react";
import { UploadDialog } from "@/components/videos/upload-dialog";
import { UploadCloud } from "lucide-react";

interface VideosWorkspaceContextType {
  openNewVideoModal: (file?: File | null, folderId?: string | null) => void;
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
  folderId?: string | null;
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

export function VideosWorkspace({ children, folderId }: VideosWorkspaceProps) {
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [overrideFolderId, setOverrideFolderId] = useState<string | null | undefined>(undefined);

  const activeFolderId = overrideFolderId !== undefined ? overrideFolderId : (folderId ?? null);

  // Drag & drop state
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Open modal handler (unified for Header, Empty State, and Drop)
  const openNewVideoModal = useCallback((file?: File | null, targetFolderId?: string | null) => {
    setModalFile(file || null);
    if (targetFolderId !== undefined) {
      setOverrideFolderId(targetFolderId);
    } else {
      setOverrideFolderId(folderId ?? null);
    }
    setIsModalOpen(true);
  }, [folderId]);

  const handleModalOpenChange = useCallback((open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setModalFile(null);
      setOverrideFolderId(undefined);
    }
  }, []);


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

        {/* ── Unified Single Modal ── */}
        <UploadDialog
          open={isModalOpen}
          onOpenChange={handleModalOpenChange}
          initialFile={modalFile}
          folderId={activeFolderId}
        />
      </div>
    </VideosWorkspaceContext.Provider>
  );
}

