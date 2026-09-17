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
import { AlertTriangle, Loader2 } from "lucide-react";
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

      toast(`Pasta "${folder.name}" excluída. Seus vídeos voltaram para a raiz da Biblioteca.`, "success");
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
      <DialogPopup className="max-w-md">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2 text-destructive">
            <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="size-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Excluir pasta
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Tem certeza que deseja excluir a pasta{" "}
            <span className="font-semibold text-foreground">&quot;{folder.name}&quot;</span>?
          </DialogDescription>

        </DialogHeader>

        <div className="p-6 space-y-3">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
            >
              {error}
            </div>
          )}

          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">
              Os vídeos não serão excluídos.
            </p>
            <p className="leading-relaxed">
              Todos os vídeos contidos nesta pasta serão movidos automaticamente de volta para a raiz da sua Biblioteca.
            </p>
          </div>
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
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleDelete}
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
      </DialogPopup>
    </Dialog>
  );
}
