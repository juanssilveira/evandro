"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { updatePlayerConfigAction } from "@/app/actions/videos";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlayCircle, Code2, Loader2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerConfig, PlayerConfigPatch } from "@/types/player-config";

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
      playback: {
        ...config.playback,
        ...(patch.playback || {}),
      },
      controls: {
        ...config.controls,
        ...(patch.controls || {}),
        fullscreen: {
          ...config.controls.fullscreen,
          ...(patch.controls?.fullscreen || {}),
        },
      },
      progress: {
        ...config.progress,
        ...(patch.progress || {}),
        fake: {
          ...config.progress.fake,
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

  return (
    <div className="space-y-6">
      {/* Category: Reprodução */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <PlayCircle className="size-4 text-primary" />
              Reprodução
            </CardTitle>
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Modos Exclusivos
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Autoplay Toggle */}
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors",
              config.playback.autoplay
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-muted/20 hover:bg-muted/30"
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
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`autoplay-switch-${videoId}`}
                    className="text-sm font-semibold text-foreground cursor-pointer"
                  >
                    Autoplay
                  </Label>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Com áudio
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  Inicia o vídeo automaticamente como uma reprodução normal. Alguns navegadores podem bloquear autoplay com áudio.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {isPending && pendingField === "autoplay" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
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
              "flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors",
              config.playback.backgroundAutoplay
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-muted/20 hover:bg-muted/30"
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
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`background-autoplay-switch-${videoId}`}
                    className="text-sm font-semibold text-foreground cursor-pointer"
                  >
                    Background Autoplay
                  </Label>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Mudo em Loop
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  Mantém o vídeo reproduzindo automaticamente no mudo como fundo antes da interação do espectador. Essa reprodução não representa uma visualização real.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {isPending && pendingField === "backgroundAutoplay" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
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

      {/* Category: Desenvolvimento */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            Desenvolvimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="space-y-1">
              <Label
                htmlFor={`debug-switch-${videoId}`}
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Debug do Player
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Exibe eventos internos do WatchMap Player no console do navegador.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isPending && pendingField === "debug" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id={`debug-switch-${videoId}`}
                checked={config.development.debug}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  handleConfigUpdate(
                    {
                      development: {
                        debug: checked,
                      },
                    },
                    "debug"
                  )
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
