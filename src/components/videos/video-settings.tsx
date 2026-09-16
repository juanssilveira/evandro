"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { updatePlayerConfigAction } from "@/app/actions/videos";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  PlayCircle,
  Play,
  Loader2,
  Volume2,
  VolumeX,
  Palette,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PlayerConfig,
  type PlayerConfigPatch,
  type PlayerAccentColor,
  type PlayerAspectRatio,
  playerAccentColors,
  PLAYER_ACCENT_PRESETS,
} from "@/types/player-config";

interface VideoSettingsProps {
  videoId: string;
  config: PlayerConfig;
  onConfigChange: (config: PlayerConfig) => void;
}

export function VideoSettings({
  videoId,
  config,
  onConfigChange,
}: VideoSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingField, setPendingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfigUpdate = (patch: PlayerConfigPatch, fieldKey: string) => {
    const previousConfig = config;
    const nextConfig: PlayerConfig = {
      ...config,
      appearance: {
        ...config.appearance,
        ...(patch.appearance || {}),
      },
      playback: {
        ...config.playback,
        ...(patch.playback || {}),
      },
      controls: {
        ...config.controls,
        ...(patch.controls || {}),
        fullscreen: {
          ...config.controls?.fullscreen,
          ...(patch.controls?.fullscreen || {}),
        },
      },
      progress: {
        ...config.progress,
        ...(patch.progress || {}),
        fake: {
          ...config.progress?.fake,
          ...(patch.progress?.fake || {}),
        },
      },
      development: {
        ...config.development,
        ...(patch.development || {}),
      },
    };

    onConfigChange(nextConfig);
    setError(null);
    setPendingField(fieldKey);

    startTransition(async () => {
      const result = await updatePlayerConfigAction({
        videoId,
        config: patch,
      });

      setPendingField(null);
      if (result.error) {
        onConfigChange(previousConfig);
        setError(result.error);
      } else if (result.config) {
        onConfigChange(result.config as PlayerConfig);
      }
    });
  };

  const handleAutoplayToggle = (checked: boolean) => {
    handleConfigUpdate(
      {
        playback: {
          autoplay: checked,
          // Se ativar autoplay, desativa backgroundAutoplay obrigatoriamente
          backgroundAutoplay: checked ? false : config.playback.backgroundAutoplay,
        },
      },
      "autoplay"
    );
  };

  const handleBackgroundAutoplayToggle = (checked: boolean) => {
    handleConfigUpdate(
      {
        playback: {
          backgroundAutoplay: checked,
          // Se ativar backgroundAutoplay, desativa autoplay obrigatoriamente
          autoplay: checked ? false : config.playback.autoplay,
        },
      },
      "backgroundAutoplay"
    );
  };

  const handleAccentColorSelect = (color: PlayerAccentColor) => {
    if (config.appearance?.accentColor === color) return;

    handleConfigUpdate(
      {
        appearance: {
          accentColor: color,
        },
      },
      "accentColor"
    );
  };

  const handleAspectRatioSelect = (ratio: PlayerAspectRatio) => {
    if (config.appearance?.aspectRatio === ratio) return;

    handleConfigUpdate(
      {
        appearance: {
          aspectRatio: ratio,
        },
      },
      "aspectRatio"
    );
  };

  const currentAccent = config.appearance?.accentColor ?? "purple";
  const currentAspectRatio = config.appearance?.aspectRatio ?? "16:9";

  return (
    <div className="space-y-6">
      {/* Category: Aparência */}
      <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" />
              Aparência
            </CardTitle>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60 uppercase tracking-wide">
              Personalização
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Personalize a identidade visual e o formato de exibição do player para o seu conteúdo.
          </p>
        </CardHeader>

        <CardContent className="pt-4 space-y-3.5">
          {/* Accent Color Section */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-foreground">
                  Cor de destaque
                </Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Aplica a cor na barra de progresso, botão de play, volume e indicadores ativos.
                </p>
              </div>
              {isPending && pendingField === "accentColor" && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-0.5">
              {playerAccentColors.map((colorKey) => {
                const preset = PLAYER_ACCENT_PRESETS[colorKey];
                const isSelected = currentAccent === colorKey;

                return (
                  <button
                    key={colorKey}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAccentColorSelect(colorKey)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 py-2.5 px-2 rounded-lg border transition-all text-center cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                    )}
                  >
                    <div
                      className="size-4.5 rounded-full shadow-inner ring-2 ring-white/10 shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: preset.tokens.base }}
                    >
                      {isSelected && (
                        <Check className="size-2.5 text-white stroke-[3]" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-medium whitespace-nowrap truncate max-w-full px-1",
                        isSelected ? "text-foreground font-semibold" : "text-muted-foreground"
                      )}
                    >
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect Ratio Section */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-foreground">
                  Formato do player
                </Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Define a proporção e as dimensões padrão do container de reprodução.
                </p>
              </div>
              {isPending && pendingField === "aspectRatio" && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
              {/* Horizontal 16:9 Option */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleAspectRatioSelect("16:9")}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all text-left cursor-pointer",
                  currentAspectRatio === "16:9"
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                    : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                )}
              >
                <div
                  className={cn(
                    "w-11 h-6.5 rounded border flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                    currentAspectRatio === "16:9"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-zinc-800 text-zinc-400"
                  )}
                >
                  <Play className="size-2.5 fill-current ml-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        currentAspectRatio === "16:9" ? "text-foreground font-bold" : "text-foreground/90"
                      )}
                    >
                      Horizontal
                    </span>
                    {currentAspectRatio === "16:9" && (
                      <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0">
                        <Check className="size-2 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5 whitespace-nowrap">
                    16:9 • ~680px padrão
                  </p>
                </div>
              </button>

              {/* Vertical 9:16 Option */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleAspectRatioSelect("9:16")}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all text-left cursor-pointer",
                  currentAspectRatio === "9:16"
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                    : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                )}
              >
                <div
                  className={cn(
                    "w-6.5 h-11 rounded border flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                    currentAspectRatio === "9:16"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-zinc-800 text-zinc-400"
                  )}
                >
                  <Play className="size-2.5 fill-current ml-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        currentAspectRatio === "9:16" ? "text-foreground font-bold" : "text-foreground/90"
                      )}
                    >
                      Vertical
                    </span>
                    {currentAspectRatio === "9:16" && (
                      <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0">
                        <Check className="size-2 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5 whitespace-nowrap">
                    9:16 • ~480px padrão
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Show Video Title Toggle */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/20 p-3.5">
            <div className="space-y-0.5">
              <Label
                htmlFor={`show-title-switch-${videoId}`}
                className="text-xs font-semibold text-foreground cursor-pointer"
              >
                Exibir título do vídeo
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Mostra o título no topo do player durante a reprodução.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {isPending && pendingField === "showTitle" && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
              <Switch
                id={`show-title-switch-${videoId}`}
                checked={config.appearance?.showTitle ?? true}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  handleConfigUpdate(
                    {
                      appearance: {
                        showTitle: checked,
                      },
                    },
                    "showTitle"
                  )
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category: Reprodução */}
      <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <PlayCircle className="size-4 text-muted-foreground" />
              Reprodução
            </CardTitle>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60 uppercase tracking-wide">
              Modos Exclusivos
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Configure o início automático e comportamento de áudio do player.
          </p>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {/* Autoplay Toggle */}
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-lg border p-3.5 transition-colors",
              config.playback.autoplay
                ? "border-primary/50 bg-primary/5"
                : "border-border/80 bg-muted/20 hover:bg-muted/30"
            )}
          >
            <div className="flex gap-3">
              <div
                className={cn(
                  "size-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  config.playback.autoplay
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Volume2 className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`autoplay-switch-${videoId}`}
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Autoplay
                  </Label>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Com áudio
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                  Inicia o vídeo automaticamente como uma reprodução normal. Alguns navegadores podem bloquear autoplay com áudio.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {isPending && pendingField === "autoplay" && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
              <Switch
                id={`autoplay-switch-${videoId}`}
                checked={config.playback.autoplay}
                disabled={isPending}
                onCheckedChange={handleAutoplayToggle}
              />
            </div>
          </div>

          {/* Background Autoplay Toggle */}
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-lg border p-3.5 transition-colors",
              config.playback.backgroundAutoplay
                ? "border-primary/50 bg-primary/5"
                : "border-border/80 bg-muted/20 hover:bg-muted/30"
            )}
          >
            <div className="flex gap-3">
              <div
                className={cn(
                  "size-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  config.playback.backgroundAutoplay
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <VolumeX className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`background-autoplay-switch-${videoId}`}
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Background Autoplay
                  </Label>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Mudo em Loop
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                  Mantém o vídeo reproduzindo automaticamente no mudo como fundo antes da interação do espectador. Essa reprodução não representa uma visualização real.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {isPending && pendingField === "backgroundAutoplay" && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
              <Switch
                id={`background-autoplay-switch-${videoId}`}
                checked={config.playback.backgroundAutoplay}
                disabled={isPending}
                onCheckedChange={handleBackgroundAutoplayToggle}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive font-medium pt-1">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
