"use client";

import * as React from "react";
import { useState } from "react";
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
import { deleteFolderAction } from "@/app/actions/folders";
import { Trash2, Loader2 } from "lucide-react";
import type { Folder } from "@/db/schema/folders";

interface DeleteFolderDialogProps {
  folder: Folder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  redirectToLibrary?: boolean;
}

export function DeleteFolderDialog({
  folder,
  open,
  onOpenChange,
  onSuccess,
  redirectToLibrary = false,
}: DeleteFolderDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError(null);
    }
  };

  const handleDelete = async () => {
    if (!folder || isPending) return;

    setIsPending(true);
    setError(null);

    try {
      const res = await deleteFolderAction({
        folderId: folder.id,
      });

      if (res.error) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      toast(`Pasta "${folder.name}" excluída.`, "success");
      handleOpenChange(false);

      if (redirectToLibrary) {
        router.push("/videos");
      } else {
        router.refresh();
      }
      onSuccess?.();
    } catch {
      setError("Ocorreu um erro ao excluir a pasta. Tente novamente.");
      setIsPending(false);
    }
  };

  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-[420px] p-6">
        <DialogClose />
        <div className="space-y-4">
          <DialogHeader className="space-y-1.5 pr-6">
            <div className="flex items-center gap-2.5 text-destructive">
              <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20 shrink-0">
                <Trash2 className="size-4" />
              </div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Excluir pasta?
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Tem certeza que deseja excluir a pasta{" "}
              <span className="font-semibold text-foreground">&quot;{folder.name}&quot;</span>?
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
            >
              {error}
            </div>
          )}

          <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">
              Os vídeos não serão apagados.
            </p>
            <p className="leading-relaxed">
              Todos os vídeos contidos nesta pasta voltarão para a raiz da Biblioteca.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="cursor-pointer font-medium"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Excluindo...
                </>
              ) : (
                "Excluir pasta"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
