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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { updateFolderAction } from "@/app/actions/folders";
import { FOLDER_COLOR_CONFIGS } from "@/lib/folder-colors";
import { folderColors, type FolderColor, type Folder } from "@/db/schema/folders";
import { FolderPen, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditFolderDialogProps {
  folder: Folder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface EditFolderFormProps {
  folder: Folder;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function EditFolderForm({ folder, onOpenChange, onSuccess }: EditFolderFormProps) {
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState<FolderColor>((folder.color as FolderColor) || "gray");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe um nome para a pasta.");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const res = await updateFolderAction({
        folderId: folder.id,
        name: trimmed,
        color,
      });

      if (res.error || !res.folder) {
        setError(res.error || "Não foi possível atualizar a pasta.");
        setIsPending(false);
        return;
      }

      toast(`Pasta "${res.folder.name}" atualizada com sucesso.`, "success");
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch {
      setError("Ocorreu um erro ao atualizar a pasta. Tente novamente.");
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary border border-primary/20">
            <FolderPen className="size-4" />
          </div>
          <DialogTitle className="text-base font-semibold text-foreground">
            Editar pasta
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs text-muted-foreground">
          Altere o nome ou a cor de identificação da pasta.
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

        {/* Name Input */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-folder-name" className="text-xs font-medium text-foreground">
            Nome da pasta <span className="text-destructive">*</span>
          </Label>
          <Input
            id="edit-folder-name"
            type="text"
            placeholder="Ex: VSLs de Teste..."
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            disabled={isPending}
            maxLength={80}
            autoFocus
            required
            className="text-xs"
          />
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">
            Cor da pasta
          </Label>
          <div className="flex items-center gap-2.5 pt-0.5">
            {folderColors.map((c) => {
              const cfg = FOLDER_COLOR_CONFIGS[c];
              const isSelected = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  disabled={isPending}
                  title={cfg.label}
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-lg transition-all cursor-pointer border",
                    cfg.iconClass,
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-zinc-950 scale-105 border-transparent shadow-xs"
                      : "hover:scale-105 opacity-80 hover:opacity-100"
                  )}
                >
                  {isSelected && <Check className="size-3.5 stroke-[2.5]" />}
                </button>
              );
            })}
          </div>
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
          type="submit"
          size="sm"
          disabled={isPending || !name.trim()}
          className="cursor-pointer font-medium"
        >
          {isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
              Salvando...
            </>
          ) : (
            "Salvar alterações"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditFolderDialog({
  folder,
  open,
  onOpenChange,
  onSuccess,
}: EditFolderDialogProps) {
  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <EditFolderForm
          key={folder.id}
          folder={folder}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      </DialogPopup>
    </Dialog>
  );
}
