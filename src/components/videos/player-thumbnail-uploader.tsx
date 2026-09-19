/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  Trash2,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PlayerConfig,
  type PlayerConfigPatch,
  type PlayerAspectRatio,
} from "@/types/player-config";
import {
  processClientThumbnail,
  RECOMMENDED_DIMENSIONS,
} from "@/lib/player/image-processing";
import {
  uploadPlayerThumbnailAction,
  removePlayerThumbnailAction,
} from "@/app/actions/videos";
import { useToast } from "@/components/ui/toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PlayerThumbnailUploaderProps {
  videoId: string;
  kind: "startup" | "pause";
  currentAspectRatio: PlayerAspectRatio;
  config: PlayerConfig;
  isPending: boolean;
  onConfigChange: (config: PlayerConfig) => void;
  onConfigUpdate: (patch: PlayerConfigPatch, fieldName: string) => void;
  pendingField: string | null;
}

export function PlayerThumbnailUploader({
  videoId,
  kind,
  currentAspectRatio,
  config,
  isPending,
  onConfigChange,
  onConfigUpdate,
  pendingField,
}: PlayerThumbnailUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const dimInfo = RECOMMENDED_DIMENSIONS[currentAspectRatio] || RECOMMENDED_DIMENSIONS["16:9"];

  if (kind === "startup") {
    const thumbConfig = config.appearance?.thumbnail;
    const isEnabled = thumbConfig?.enabled ?? true;
    const currentSource = thumbConfig?.source ?? "provider";
    const customUrl = thumbConfig?.customUrl;
    const customAspect = thumbConfig?.customAspectRatio;
    const isBgAutoplay = Boolean(config.playback?.backgroundAutoplay);

    const hasAspectMismatch = Boolean(
      currentSource === "custom" &&
        customUrl &&
        customAspect &&
        customAspect !== currentAspectRatio
    );

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset file input so same file can be re-selected if needed
      e.target.value = "";

      setIsUploading(true);
      try {
        const processed = await processClientThumbnail(file, currentAspectRatio);

        const formData = new FormData();
        formData.append("videoId", videoId);
        formData.append("kind", "startup");
        formData.append("aspectRatio", currentAspectRatio);
        formData.append(
          "file",
          processed.blob,
          `thumbnail-${currentAspectRatio}.webp`
        );

        const res = await uploadPlayerThumbnailAction(formData);

        if (res.error) {
          toast(res.error, "error");
        } else if (res.config) {
          onConfigChange(res.config);
          toast("A imagem inicial personalizada foi salva com sucesso.", "success");
        }
      } catch (err) {
        console.error("[Thumbnail Upload]", err);
        toast(
          err instanceof Error
            ? err.message
            : "Não foi possível preparar a imagem para upload.",
          "error"
        );
      } finally {
        setIsUploading(false);
      }
    };

    const handleRemove = async () => {
      setIsRemoving(true);
      try {
        const res = await removePlayerThumbnailAction({
          videoId,
          kind: "startup",
        });

        if (res.error) {
          toast(res.error, "error");
        } else if (res.config) {
          onConfigChange(res.config);
          toast("Thumbnail personalizada removida.", "success");
        }
      } catch (err) {
        console.error("[Thumbnail Remove]", err);
        toast("Não foi possível remover a thumbnail personalizada.", "error");
      } finally {
        setIsRemoving(false);
      }
    };

    return (
      <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3.5">
        {/* Header with Switch */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label
              htmlFor={`show-thumbnail-switch-${videoId}`}
              className="text-xs font-semibold text-foreground cursor-pointer block"
            >
              Thumbnail inicial
            </Label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Imagem exibida enquanto o vídeo aguarda o início da reprodução.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPending && pendingField === "thumbnailEnabled" && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            )}
            <Switch
              id={`show-thumbnail-switch-${videoId}`}
              checked={isEnabled}
              disabled={isPending || isUploading || isRemoving}
              onCheckedChange={(checked) =>
                onConfigUpdate(
                  {
                    appearance: {
                      thumbnail: {
                        enabled: checked,
                      },
                    },
                  },
                  "thumbnailEnabled"
                )
              }
            />
          </div>
        </div>

        {/* Background Autoplay Active Warning */}
        {isBgAutoplay && (
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400 text-[11px] leading-relaxed">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              A thumbnail inicial não é exibida enquanto o Background Autoplay estiver ativo.
            </span>
          </div>
        )}

        {/* Source Selector & Upload (shown when enabled) */}
        {isEnabled && (
          <div className="space-y-3 pt-0.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-foreground">
                Fonte da imagem
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {/* Provider Automatic Option */}
                <button
                  type="button"
                  disabled={isPending || isUploading || isRemoving}
                  onClick={() => {
                    if (currentSource === "provider") return;
                    onConfigUpdate(
                      {
                        appearance: {
                          thumbnail: {
                            source: "provider",
                          },
                        },
                      },
                      "thumbnailSource"
                    );
                  }}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-all",
                    currentSource === "provider"
                      ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/40 hover:border-border/80"
                  )}
                >
                  <div className="space-y-0.5 min-w-0">
                    <span
                      className={cn(
                        "text-xs block font-semibold truncate",
                        currentSource === "provider"
                          ? "text-foreground font-bold"
                          : "text-foreground/90"
                      )}
                    >
                      Automática
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Capa gerada pelo vídeo
                    </span>
                  </div>
                  {currentSource === "provider" && (
                    <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0 ml-1.5">
                      <Check className="size-2 stroke-[3]" />
                    </span>
                  )}
                </button>

                {/* Custom Option */}
                <button
                  type="button"
                  disabled={isPending || isUploading || isRemoving}
                  onClick={() => {
                    if (currentSource === "custom") return;
                    onConfigUpdate(
                      {
                        appearance: {
                          thumbnail: {
                            source: "custom",
                          },
                        },
                      },
                      "thumbnailSource"
                    );
                  }}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-all",
                    currentSource === "custom"
                      ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/40 hover:border-border/80"
                  )}
                >
                  <div className="space-y-0.5 min-w-0">
                    <span
                      className={cn(
                        "text-xs block font-semibold truncate",
                        currentSource === "custom"
                          ? "text-foreground font-bold"
                          : "text-foreground/90"
                      )}
                    >
                      Personalizada
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Enviar imagem própria
                    </span>
                  </div>
                  {currentSource === "custom" && (
                    <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0 ml-1.5">
                      <Check className="size-2 stroke-[3]" />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Custom Image Management Box */}
            {currentSource === "custom" && (
              <div className="p-3 rounded-lg border border-border/70 bg-card/60 space-y-3">
                {/* Aspect ratio warning */}
                {hasAspectMismatch && (
                  <div className="flex items-start gap-2 p-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400 text-[11px] leading-relaxed">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>
                      Esta imagem foi preparada para {customAspect}. Para melhor resultado em {currentAspectRatio}, envie uma nova imagem.
                    </span>
                  </div>
                )}

                {/* Preview or Upload Box */}
                {customUrl ? (
                  <div className="space-y-2.5">
                    <div className="relative w-full aspect-video rounded-md overflow-hidden border border-border/60 bg-black/40">
                      <img
                        src={customUrl}
                        alt="Thumbnail inicial"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white backdrop-blur-xs">
                        {customAspect || currentAspectRatio}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp,.jfif,.avif"
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={isUploading || isRemoving}
                      />
                      <button
                        type="button"
                        disabled={isUploading || isRemoving}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isUploading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        Substituir imagem
                      </button>

                      <button
                        type="button"
                        disabled={isUploading || isRemoving}
                        onClick={handleRemove}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer disabled:opacity-50 border border-destructive/20"
                      >
                        {isRemoving ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Remover personalizada
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp,.jfif,.avif"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />

                    <div
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      className={cn(
                        "flex flex-col items-center justify-center p-5 rounded-lg border border-dashed border-border/80 hover:border-primary/60 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all text-center",
                        isUploading && "pointer-events-none opacity-60"
                      )}
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <Loader2 className="size-6 animate-spin text-primary" />
                          <span className="text-xs font-medium text-foreground">
                            Processando imagem em WebP...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-1">
                            <Upload className="size-4" />
                          </div>
                          <span className="text-xs font-semibold text-foreground">
                            Enviar imagem personalizada
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Clique para selecionar do computador
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Technical Dimension & Specs Notice */}
                <div className="space-y-0.5 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                  <p className="font-medium text-foreground/80">
                    Tamanho recomendado: {dimInfo.label}
                  </p>
                  <p>JPG, PNG ou WebP • até 10 MB</p>
                  <p className="text-[10px] text-muted-foreground/80">
                    Imagens fora dessa proporção serão recortadas para preencher o player.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Kind === "pause"
  const pauseConfig = config.appearance?.pauseThumbnail;
  const isPauseEnabled = pauseConfig?.enabled ?? false;
  const customUrl = pauseConfig?.customUrl;
  const customAspect = pauseConfig?.customAspectRatio;

  const hasAspectMismatch = Boolean(
    isPauseEnabled && customUrl && customAspect && customAspect !== currentAspectRatio
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";
    setIsUploading(true);

    try {
      const processed = await processClientThumbnail(file, currentAspectRatio);

      const formData = new FormData();
      formData.append("videoId", videoId);
      formData.append("kind", "pause");
      formData.append("aspectRatio", currentAspectRatio);
      formData.append(
        "file",
        processed.blob,
        `pause-${currentAspectRatio}.webp`
      );

      const res = await uploadPlayerThumbnailAction(formData);

      if (res.error) {
        toast(res.error, "error");
      } else if (res.config) {
        onConfigChange(res.config);
        toast("A imagem de pausa personalizada foi salva com sucesso.", "success");
      }
    } catch (err) {
      console.error("[Pause Thumbnail Upload]", err);
      toast(
        err instanceof Error
          ? err.message
          : "Não foi possível preparar a imagem para upload.",
        "error"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const res = await removePlayerThumbnailAction({
        videoId,
        kind: "pause",
      });

      if (res.error) {
        toast(res.error, "error");
      } else if (res.config) {
        onConfigChange(res.config);
        toast('O player voltará a exibir o card "Continue assistindo".', "success");
      }
    } catch (err) {
      console.error("[Pause Thumbnail Remove]", err);
      toast("Não foi possível remover a thumbnail de pausa.", "error");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-xs font-semibold text-foreground">
            Ao pausar
          </Label>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Escolha o que exibir na tela quando o espectador pausar o vídeo.
          </p>
        </div>
        {isPending && pendingField === "pauseThumbnail" && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Choice Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
        {/* Option 1: "Continue assistindo" */}
        <button
          type="button"
          disabled={isPending || isUploading || isRemoving}
          onClick={() => {
            if (!isPauseEnabled) return;
            onConfigUpdate(
              {
                appearance: {
                  pauseThumbnail: {
                    enabled: false,
                  },
                },
              },
              "pauseThumbnail"
            );
          }}
          className={cn(
            "flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-all",
            !isPauseEnabled
              ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xs"
              : "border-border/60 bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="space-y-0.5 min-w-0">
            <span
              className={cn(
                "text-xs block font-semibold truncate",
                !isPauseEnabled
                  ? "text-foreground font-bold"
                  : "text-foreground/90"
              )}
            >
              Continue assistindo
            </span>
            <span className="text-[10px] text-muted-foreground block truncate">
              Card padrão de retomada
            </span>
          </div>
          {!isPauseEnabled && (
            <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0 ml-1.5">
              <Check className="size-2 stroke-[3]" />
            </span>
          )}
        </button>

        {/* Option 2: Custom Pause Thumbnail */}
        <button
          type="button"
          disabled={isPending || isUploading || isRemoving}
          onClick={() => {
            if (isPauseEnabled) return;
            onConfigUpdate(
              {
                appearance: {
                  pauseThumbnail: {
                    enabled: true,
                  },
                },
              },
              "pauseThumbnail"
            );
          }}
          className={cn(
            "flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-all",
            isPauseEnabled
              ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xs"
              : "border-border/60 bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="space-y-0.5 min-w-0">
            <span
              className={cn(
                "text-xs block font-semibold truncate",
                isPauseEnabled
                  ? "text-foreground font-bold"
                  : "text-foreground/90"
              )}
            >
              Thumbnail personalizada
            </span>
            <span className="text-[10px] text-muted-foreground block truncate">
              Imagem de pausa customizada
            </span>
          </div>
          {isPauseEnabled && (
            <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0 ml-1.5">
              <Check className="size-2 stroke-[3]" />
            </span>
          )}
        </button>
      </div>

      {/* Custom Pause Image Management */}
      {isPauseEnabled && (
        <div className="p-3 rounded-lg border border-border/70 bg-card/60 space-y-3">
          {/* Aspect mismatch warning */}
          {hasAspectMismatch && (
            <div className="flex items-start gap-2 p-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400 text-[11px] leading-relaxed">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>
                Esta imagem foi preparada para {customAspect}. Para melhor resultado em {currentAspectRatio}, envie uma nova imagem.
              </span>
            </div>
          )}

          {/* Preview or Upload */}
          {customUrl ? (
            <div className="space-y-2.5">
              <div className="relative w-full aspect-video rounded-md overflow-hidden border border-border/60 bg-black/40">
                <img
                  src={customUrl}
                  alt="Thumbnail de pausa"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white backdrop-blur-xs">
                  {customAspect || currentAspectRatio}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp,.jfif,.avif"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading || isRemoving}
                />
                <button
                  type="button"
                  disabled={isUploading || isRemoving}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Substituir imagem
                </button>

                <button
                  type="button"
                  disabled={isUploading || isRemoving}
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer disabled:opacity-50 border border-destructive/20"
                >
                  {isRemoving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp,.jfif,.avif"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />

              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center p-5 rounded-lg border border-dashed border-border/80 hover:border-primary/60 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all text-center",
                  isUploading && "pointer-events-none opacity-60"
                )}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="text-xs font-medium text-foreground">
                      Processando imagem em WebP...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-1">
                      <ImageIcon className="size-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      Enviar thumbnail de pausa
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Clique para selecionar do computador
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technical Dimension & Specs Notice */}
          <div className="space-y-0.5 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
            <p className="font-medium text-foreground/80">
              Tamanho recomendado: {dimInfo.label}
            </p>
            <p>JPG, PNG ou WebP • até 10 MB</p>
            <p className="text-[10px] text-muted-foreground/80">
              Imagens fora dessa proporção serão recortadas para preencher o player.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
