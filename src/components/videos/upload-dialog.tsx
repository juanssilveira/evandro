"use client";

import * as React from "react";
import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTrigger,
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
import { createUploadUrlAction, syncVideoStatusAction } from "@/app/actions/videos";
import { UploadCloud, Film, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface UploadDialogProps {
  trigger?: React.ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function UploadDialog({ trigger }: UploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const resetState = () => {
    setFile(null);
    setTitle("");
    setIsDragging(false);
    setProgress(null);
    setStatus("idle");
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (status === "uploading") {
      return; // prevent closing while sending binary
    }
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type !== "video/mp4" && !selectedFile.name.toLowerCase().endsWith(".mp4")) {
      setErrorMessage("Por favor, selecione apenas arquivos de vídeo no formato MP4 (video/mp4).");
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);

    // Prefill title with filename without extension
    const nameWithoutExt = selectedFile.name.replace(/\.mp4$/i, "");
    setTitle(nameWithoutExt);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (status === "uploading") return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (status === "uploading") return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setStatus("uploading");
    setProgress(0);
    setErrorMessage(null);

    try {
      // 1. Get Direct Upload URL from server
      const uploadRes = await createUploadUrlAction({
        title: title.trim(),
        filename: file.name,
        mimeType: "video/mp4",
        sizeBytes: file.size,
      });

      if (uploadRes.error || !uploadRes.data) {
        throw new Error(uploadRes.error || "Não foi possível obter a URL de upload.");
      }

      const { videoId, uploadUrl } = uploadRes.data;

      // 2. Direct upload to Mux via XMLHttpRequest with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Falha no envio do vídeo (HTTP ${xhr.status}).`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Erro de conexão durante o upload do vídeo."));
        };

        xhr.send(file);
      });

      // 3. Immediately trigger initial status sync & close modal without trapping user
      syncVideoStatusAction({ videoId }).catch(() => {});

      startTransition(() => {
        router.refresh();
      });

      setOpen(false);
      resetState();
    } catch (err: unknown) {
      console.error(err);
      setStatus("error");
      const message =
        err instanceof Error ? err.message : "Ocorreu um erro durante o upload.";
      setErrorMessage(message);
    }
  };

  const isBusy = status === "uploading";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          (trigger as React.ReactElement) || (
            <Button>
              <UploadCloud className="size-4 mr-1.5" />
              Enviar vídeo
            </Button>
          )
        }
      />

      <DialogPopup className="sm:max-w-md">
        <form onSubmit={handleUpload}>
          <DialogHeader>
            <DialogTitle>Enviar vídeo</DialogTitle>
            <DialogDescription>
              Selecione um arquivo de vídeo MP4 para enviar para a biblioteca da sua conta.
            </DialogDescription>
          </DialogHeader>

          <DialogClose disabled={isBusy} />

          <div className="space-y-4 py-3">
            {/* Drag & Drop Area */}
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/30"
                }`}
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3 border border-primary/20">
                  <UploadCloud className="size-5" />
                </div>
                <p className="text-xs font-medium text-foreground">
                  Arraste um vídeo aqui ou <span className="text-primary font-semibold hover:underline">procure no dispositivo</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Apenas arquivos MP4 (.mp4)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <Film className="size-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>

                {!isBusy && status !== "success" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={resetState}
                  >
                    Alterar
                  </Button>
                )}
              </div>
            )}

            {/* Title Input */}
            {file && (
              <div className="space-y-1.5">
                <Label htmlFor="video-title" className="text-xs font-medium text-foreground">
                  Título do vídeo
                </Label>
                <Input
                  id="video-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isBusy || status === "success"}
                  placeholder="Nome do vídeo"
                  required
                />
              </div>
            )}

            {/* Progress Bar & Status */}
            {status !== "idle" && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    {status === "uploading" && (
                      <>
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        Enviando vídeo...
                      </>
                    )}
                    {status === "success" && (
                      <>
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        Upload concluído com sucesso!
                      </>
                    )}
                    {status === "error" && (
                      <>
                        <AlertCircle className="size-3.5 text-destructive" />
                        Erro no envio
                      </>
                    )}
                  </span>
                  {progress !== null && status === "uploading" && (
                    <span className="text-muted-foreground font-mono text-[11px]">{progress}%</span>
                  )}
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full transition-all duration-200 ${
                      status === "error"
                        ? "bg-destructive w-full"
                        : status === "success"
                        ? "bg-emerald-600 w-full"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${progress || 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={isBusy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!file || !title.trim() || isBusy || status === "success"}
            >
              {isBusy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Enviando...
                </>
              ) : (
                "Iniciar upload"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
