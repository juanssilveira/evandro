"use client";

import * as React from "react";
import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateVideoTitleAction } from "@/app/actions/videos";
import { Loader2, Film, HardDrive, Calendar, FileType, Pencil } from "lucide-react";
import type { Video } from "@/db/schema";

interface EditVideoDialogProps {
  video: {
    id: string;
    title: string;
    originalFilename: string;
    sizeBytes: number;
    mimeType: string;
    createdAt: Date | string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updatedVideo: Video) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

interface EditVideoFormProps {
  video: EditVideoDialogProps["video"];
  onClose: () => void;
  onSuccess?: (updatedVideo: Video) => void;
}

function EditVideoForm({ video, onClose, onSuccess }: EditVideoFormProps) {
  const [title, setTitle] = useState(video.title);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("O título é obrigatório.");
      return;
    }

    if (trimmedTitle.length > 120) {
      setError("O título deve ter no máximo 120 caracteres.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await updateVideoTitleAction({
        videoId: video.id,
        title: trimmedTitle,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.video) {
        onSuccess?.(result.video as Video);
        onClose();
      }
    });
  };

  const isSaveDisabled = isPending || !title.trim() || title.trim().length > 120;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Título input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`edit-title-${video.id}`} className="text-xs font-semibold text-foreground">
            Título <span className="text-destructive">*</span>
          </Label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {title.length}/120
          </span>
        </div>
        <Input
          id={`edit-title-${video.id}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Digite o título do vídeo"
          maxLength={120}
          disabled={isPending}
          autoFocus
          className="h-9 text-xs"
        />
      </div>

      {/* Informações do vídeo (Read-only) */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2.5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
          Informações do arquivo
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-start gap-2 min-w-0">
            <Film className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground block">Nome original</span>
              <p className="font-mono text-[11px] text-foreground truncate" title={video.originalFilename}>
                {video.originalFilename}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 min-w-0">
            <HardDrive className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground block">Tamanho</span>
              <p className="font-mono text-[11px] text-foreground">
                {formatBytes(video.sizeBytes)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 min-w-0">
            <FileType className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground block">Tipo</span>
              <p className="font-mono text-[11px] text-foreground">
                {video.mimeType}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 min-w-0">
            <Calendar className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground block">Enviado em</span>
              <p suppressHydrationWarning className="font-mono text-[11px] text-foreground">
                {formatDate(video.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive font-medium">{error}</p>
      )}

      <DialogFooter className="pt-2 gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onClose}
          className="h-8.5 px-4 text-xs font-medium cursor-pointer shadow-2xs"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSaveDisabled}
          className="h-8.5 px-4 text-xs font-medium gap-1.5 cursor-pointer shadow-2xs"
        >
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar alterações
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditVideoDialog({
  video,
  open,
  onOpenChange,
  onSuccess,
}: EditVideoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Pencil className="size-3.5" />
            </div>
            <DialogTitle>Editar vídeo</DialogTitle>
          </div>
          <DialogDescription>
            Altere o título de identificação do vídeo. As informações de arquivo são somente leitura.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <EditVideoForm
            video={video}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}

        <DialogClose />
      </DialogPopup>
    </Dialog>
  );
}
