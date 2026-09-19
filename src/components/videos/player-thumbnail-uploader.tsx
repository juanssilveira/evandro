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
  Play,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PlayerConfig,
  type PlayerConfigPatch,
  type PlayerAspectRatio,
  type PlayerAccentColor,
  PLAYER_ACCENT_PRESETS,
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

/**
 * Preview frame representing 16:9, 9:16 or 1:1 without distortion,
 * with optional real-time Play button overlay matching player accent color.
 */
function ThumbnailAspectPreview({
  imageUrl,
  aspectRatio,
  showPlayButton,
  accentColor = "purple",
  alt,
}: {
  imageUrl: string;
  aspectRatio: PlayerAspectRatio | null;
  showPlayButton: boolean;
  accentColor?: PlayerAccentColor;
  alt: string;
}) {
  const effectiveAspect = aspectRatio || "16:9";
  const preset = PLAYER_ACCENT_PRESETS[accentColor] || PLAYER_ACCENT_PRESETS.purple;

  const aspectContainerClass =
    effectiveAspect === "9:16"
      ? "w-full max-w-[160px] aspect-[9/16] max-h-64"
      : effectiveAspect === "1:1"
      ? "w-full max-w-[210px] aspect-square"
      : "w-full aspect-video max-w-md";

  return (
    <div className="flex items-center justify-center p-2.5 rounded-lg bg-muted/40 border border-border/60">
      <div
        className={cn(
          "relative mx-auto rounded-lg overflow-hidden border border-border/80 bg-zinc-950 flex items-center justify-center shadow-xs transition-all",
          aspectContainerClass
        )}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover select-none pointer-events-none"
        />

        {/* Aspect Ratio Badge */}
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white backdrop-blur-xs border border-white/10 z-1">
          {effectiveAspect}
        </div>

        {/* Real-time Central Play Button Preview */}
        {showPlayButton && (
          <div
            style={{
              backgroundColor: preset.tokens.base,
              color: preset.tokens.foreground,
            }}
            className="absolute z-1 flex size-11 items-center justify-center rounded-full shadow-xl pointer-events-none transition-transform animate-in fade-in zoom-in-90 duration-150"
          >
            <Play className="size-5 ml-0.5 fill-current" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Clean Play Button Visibility Setting Row
 */
function ThumbnailPlayButtonSetting({
  id,
  checked,
  disabled,
  isPending,
  label = "Botão de reprodução",
  description,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  disabled: boolean;
  isPending: boolean;
  label?: string;
  description: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/60">
      <div className="space-y-0.5">
        <Label
          htmlFor={id}
          className="text-xs font-semibold text-foreground cursor-pointer block"
        >
          {label}
        </Label>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isPending && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  );
}

/**
 * Compact Technical Specs Footer
 */
function ThumbnailTechnicalSpecs({ dimLabel }: { dimLabel: string }) {
  return (
    <div className="space-y-0.5 pt-2 text-[11px] text-muted-foreground border-t border-border/40">
      <p className="font-medium text-foreground/80">
        Tamanho recomendado: {dimLabel}
      </p>
      <p>JPG, PNG ou WebP • até 10 MB</p>
      <p className="text-[10px] text-muted-foreground/80">
        Imagens fora dessa proporção serão recortadas para preencher o player.
      </p>
    </div>
  );
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
  const accentColor = config.appearance?.accentColor ?? "purple";

  // -------------------------------------------------------------
  // STARTUP THUMBNAIL LOGIC & UI
  // -------------------------------------------------------------
  if (kind === "startup") {
    const thumbConfig = config.appearance?.thumbnail;
    const isEnabled = thumbConfig?.enabled ?? true;
    const currentSource = thumbConfig?.source ?? "provider";
    const customUrl = thumbConfig?.customUrl;
    const customAspect = thumbConfig?.customAspectRatio;
    const isBgAutoplay = Boolean(config.playback?.backgroundAutoplay);
    const showPlayButton = thumbConfig?.showPlayButton ?? true;

    const hasAspectMismatch = Boolean(
      currentSource === "custom" &&
        customUrl &&
        customAspect &&
        customAspect !== currentAspectRatio
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

    const statusBadgeText = !isEnabled
      ? "Desativada"
      : currentSource === "custom" && customUrl
      ? "Personalizada"
      : "Automática";

    return (
      <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3.5">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-6 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/70">
              <ImageIcon className="size-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`show-thumbnail-switch-${videoId}`}
                  className="text-xs font-semibold text-foreground cursor-pointer block truncate"
                >
                  Thumbnail inicial
                </Label>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/60 shrink-0">
                  {statusBadgeText}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed truncate sm:whitespace-normal">
                Imagem exibida enquanto o vídeo aguarda o início da reprodução.
              </p>
            </div>
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

        {/* Mode Selector & Custom Asset Management (when enabled) */}
        {isEnabled && (
          <div className="space-y-3 pt-0.5">
            {/* Mode Selector */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-foreground">
                Exibição
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

            {/* Custom Asset Section */}
            {currentSource === "custom" && (
              <div className="p-3.5 rounded-lg border border-border/80 bg-card space-y-3">
                {/* Aspect Ratio Mismatch Alert */}
                {hasAspectMismatch && (
                  <div className="flex items-start gap-2 p-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400 text-[11px] leading-relaxed">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>
                      Esta imagem foi preparada para {customAspect}. Para melhor resultado em {currentAspectRatio}, envie uma nova imagem.
                    </span>
                  </div>
                )}

                {/* Existing Custom Image Panel */}
                {customUrl ? (
                  <div className="space-y-3">
                    {/* Visual Asset Preview with optional Play */}
                    <ThumbnailAspectPreview
                      imageUrl={customUrl}
                      aspectRatio={customAspect || currentAspectRatio}
                      showPlayButton={showPlayButton}
                      accentColor={accentColor}
                      alt="Thumbnail inicial personalizada"
                    />

                    {/* Operational Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
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
                        disabled={isUploading || isRemoving || isPending}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border rounded-md transition-colors cursor-pointer disabled:opacity-50"
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
                        disabled={isUploading || isRemoving || isPending}
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

                    {/* Play Button Visibility Setting (Exclusive to existing custom thumbnail) */}
                    <ThumbnailPlayButtonSetting
                      id={`startup-play-switch-${videoId}`}
                      checked={showPlayButton}
                      disabled={isPending || isUploading || isRemoving}
                      isPending={isPending && pendingField === "thumbnailPlayButton"}
                      description="Exibe um botão de Play central sobre a imagem inicial."
                      onCheckedChange={(checked) =>
                        onConfigUpdate(
                          {
                            appearance: {
                              thumbnail: {
                                showPlayButton: checked,
                              },
                            },
                          },
                          "thumbnailPlayButton"
                        )
                      }
                    />
                  </div>
                ) : (
                  /* Empty Upload Box */
                  <div className="space-y-3">
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
                        "flex flex-col items-center justify-center p-5 rounded-lg border border-dashed border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all text-center",
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
                          <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-0.5 border border-border/60">
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

                {/* Technical Specs Notice */}
                <ThumbnailTechnicalSpecs dimLabel={dimInfo.label} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // PAUSE THUMBNAIL LOGIC & UI
  // -------------------------------------------------------------
  const pauseConfig = config.appearance?.pauseThumbnail;
  const isPauseEnabled = pauseConfig?.enabled ?? false;
  const customUrl = pauseConfig?.customUrl;
  const customAspect = pauseConfig?.customAspectRatio;
  const showPlayButton = pauseConfig?.showPlayButton ?? false;

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

  const pauseStatusBadgeText = isPauseEnabled && customUrl
    ? "Personalizada"
    : "Continue assistindo";

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-6 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/70">
            <Pause className="size-3.5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold text-foreground block truncate">
                Ao pausar
              </Label>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/60 shrink-0">
                {pauseStatusBadgeText}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed truncate sm:whitespace-normal">
              Escolha o que exibir na tela quando o espectador pausar o vídeo.
            </p>
          </div>
        </div>
        {isPending && pendingField === "pauseThumbnail" && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Choice Selector */}
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

      {/* Custom Pause Asset Section */}
      {isPauseEnabled && (
        <div className="p-3.5 rounded-lg border border-border/80 bg-card space-y-3">
          {/* Aspect Mismatch Alert */}
          {hasAspectMismatch && (
            <div className="flex items-start gap-2 p-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400 text-[11px] leading-relaxed">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>
                Esta imagem foi preparada para {customAspect}. Para melhor resultado em {currentAspectRatio}, envie uma nova imagem.
              </span>
            </div>
          )}

          {/* Existing Custom Pause Image Panel */}
          {customUrl ? (
            <div className="space-y-3">
              {/* Visual Asset Preview with optional Play */}
              <ThumbnailAspectPreview
                imageUrl={customUrl}
                aspectRatio={customAspect || currentAspectRatio}
                showPlayButton={showPlayButton}
                accentColor={accentColor}
                alt="Thumbnail de pausa personalizada"
              />

              {/* Operational Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
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
                  disabled={isUploading || isRemoving || isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border rounded-md transition-colors cursor-pointer disabled:opacity-50"
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
                  disabled={isUploading || isRemoving || isPending}
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

              {/* Play Button Visibility Setting (Exclusive to existing custom pause thumbnail) */}
              <ThumbnailPlayButtonSetting
                id={`pause-play-switch-${videoId}`}
                checked={showPlayButton}
                disabled={isPending || isUploading || isRemoving}
                isPending={isPending && pendingField === "pauseThumbnailPlayButton"}
                description="Exibe um botão de Play central sobre a imagem de pausa."
                onCheckedChange={(checked) =>
                  onConfigUpdate(
                    {
                      appearance: {
                        pauseThumbnail: {
                          showPlayButton: checked,
                        },
                      },
                    },
                    "pauseThumbnailPlayButton"
                  )
                }
              />
            </div>
          ) : (
            /* Empty Upload Box */
            <div className="space-y-3">
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
                  "flex flex-col items-center justify-center p-5 rounded-lg border border-dashed border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all text-center",
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
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-0.5 border border-border/60">
                      <Upload className="size-4" />
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

          {/* Technical Specs Notice */}
          <ThumbnailTechnicalSpecs dimLabel={dimInfo.label} />
        </div>
      )}
    </div>
  );
}
