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
import { deleteVideoAction } from "@/app/actions/videos";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

interface DeleteVideoDialogProps {
  video: {
    id: string;
    title: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteVideoDialog({
  video,
  open,
  onOpenChange,
  onSuccess,
}: DeleteVideoDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);

    startTransition(async () => {
      const result = await deleteVideoAction({
        videoId: video.id,
      });

      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md border-destructive/30">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
              <Trash2 className="size-4" />
            </div>
            <DialogTitle className="text-base text-foreground leading-snug">
              Excluir &ldquo;{video.title}&rdquo;?
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed">
            O vídeo e suas configurações serão removidos permanentemente. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-2.5 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            O arquivo do vídeo no Cloudflare R2 e todas as personalizações vinculadas serão apagados definitivamente.
          </p>
        </div>

        {error && (
          <p className="text-xs text-destructive font-medium">{error}</p>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleDelete}
            className="gap-1.5"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Excluir vídeo
          </Button>
        </DialogFooter>

        <DialogClose />
      </DialogPopup>
    </Dialog>
  );
}
