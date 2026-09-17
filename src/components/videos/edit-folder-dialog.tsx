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
  initialMode?: "rename" | "color";
}

interface EditFolderFormProps {
  folder: Folder;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialMode?: "rename" | "color";
}

function EditFolderForm({
  folder,
  onOpenChange,
  onSuccess,
  initialMode = "rename",
}: EditFolderFormProps) {
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader className="space-y-1.5 pr-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary border border-primary/20 shrink-0">
            <FolderPen className="size-4" />
          </div>
          <DialogTitle className="text-base font-semibold text-foreground">
            {initialMode === "color" ? "Alterar cor da pasta" : "Editar pasta"}
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs text-muted-foreground">
          Altere o nome ou a cor de identificação da pasta.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
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
            placeholder="Nome da pasta"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            disabled={isPending}
            maxLength={80}
            autoFocus={initialMode === "rename"}
            required
            className="text-xs h-9 bg-white dark:bg-zinc-900 border-border"
          />
        </div>

        {/* Color Picker Swatches */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">
            Cor de identificação
          </Label>
          <div className="flex items-center gap-3 pt-0.5">
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
                  aria-label={`Cor ${cfg.label}`}
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-full transition-all cursor-pointer",
                    cfg.swatchBg,
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-zinc-950 scale-110 shadow-xs"
                      : "hover:scale-105 opacity-85 hover:opacity-100 ring-1 ring-black/10 dark:ring-white/10"
                  )}
                >
                  {isSelected && <Check className="size-3.5 text-white stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => onOpenChange(false)}
          className="cursor-pointer"
        >
          Cancelar
        </Button>
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
  initialMode = "rename",
}: EditFolderDialogProps) {
  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-[460px] p-6">
        <DialogClose />
        <EditFolderForm
          key={`${folder.id}-${folder.name}-${folder.color}-${initialMode}`}
          folder={folder}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
          initialMode={initialMode}
        />
      </DialogPopup>
    </Dialog>
  );
}
