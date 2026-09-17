"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { moveVideoToFolderAction, getAccountFoldersAction } from "@/app/actions/folders";
import { FOLDER_COLOR_CONFIGS } from "@/lib/folder-colors";
import type { FolderColor, Folder } from "@/db/schema/folders";
import type { Video } from "@/db/schema";
import { FolderInput, Folder as FolderIcon, Library, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoveVideoDialogProps {
  video: Video | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MoveVideoContentProps {
  video: Video;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function MoveVideoContent({ video, onOpenChange, onSuccess }: MoveVideoContentProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(video.folderId ?? null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    getAccountFoldersAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.folders) {
          setFolders(res.folders);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError("Não foi possível carregar as pastas.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingFolders(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMove = async () => {
    if (isPending) return;

    setIsPending(true);
    setError(null);

    try {
      const res = await moveVideoToFolderAction({
        videoId: video.id,
        folderId: selectedFolderId,
      });

      if (res.error) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      const targetFolderName = selectedFolderId
        ? folders.find((f) => f.id === selectedFolderId)?.name
        : null;

      if (targetFolderName) {
        toast(`Vídeo movido para a pasta "${targetFolderName}".`, "success");
      } else {
        toast("Vídeo movido para a raiz da Biblioteca.", "success");
      }

      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch {
      setError("Ocorreu um erro ao mover o vídeo. Tente novamente.");
      setIsPending(false);
    }
  };

  return (
    <>
      <DialogHeader className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary border border-primary/20">
            <FolderInput className="size-4" />
          </div>
          <DialogTitle className="text-base font-semibold text-foreground">
            Mover para pasta
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs text-muted-foreground truncate max-w-sm">
          Escolha o destino para <span className="font-semibold text-foreground">&quot;{video.title}&quot;</span>
        </DialogDescription>
      </DialogHeader>

      <div className="p-6 space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
          >
            {error}
          </div>
        )}

        {isLoadingFolders ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Carregando pastas...</span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {/* Root Library Option */}
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={cn(
                "flex w-full items-center justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer text-xs",
                selectedFolderId === null
                  ? "border-primary bg-primary/5 text-foreground font-medium shadow-2xs"
                  : "border-border/70 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 items-center justify-center rounded-md bg-muted border border-border text-foreground">
                  <Library className="size-3.5" />
                </div>
                <div className="truncate">
                  <p className="font-medium truncate text-foreground">
                    Biblioteca (Raiz)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sem pasta
                  </p>
                </div>
              </div>
              {selectedFolderId === null && (
                <Check className="size-4 text-primary shrink-0" />
              )}
            </button>

            {/* Folders List */}
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              const cfg =
                FOLDER_COLOR_CONFIGS[
                  (folder.color as FolderColor) || "gray"
                ] || FOLDER_COLOR_CONFIGS.gray;

              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={cn(
                    "flex w-full items-center justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer text-xs",
                    isSelected
                      ? "border-primary bg-primary/5 text-foreground font-medium shadow-2xs"
                      : "border-border/70 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md border shrink-0",
                        cfg.iconClass
                      )}
                    >
                      <FolderIcon className="size-3.5 fill-current/15" />
                    </div>
                    <span className="font-medium truncate text-foreground">
                      {folder.name}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="size-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <DialogFooter>
        <DialogClose
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
          }
        />
        <Button
          type="button"
          size="sm"
          disabled={isPending || isLoadingFolders}
          onClick={handleMove}
          className="cursor-pointer font-medium"
        >
          {isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
              Movendo...
            </>
          ) : (
            "Confirmar"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export function MoveVideoDialog({
  video,
  open,
  onOpenChange,
  onSuccess,
}: MoveVideoDialogProps) {
  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <MoveVideoContent
          key={video.id}
          video={video}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      </DialogPopup>
    </Dialog>
  );
}
