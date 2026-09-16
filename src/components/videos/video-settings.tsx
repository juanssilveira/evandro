"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { updatePlayerConfigAction } from "@/app/actions/videos";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlayCircle, Code2, Loader2 } from "lucide-react";
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

  return (
    <div className="space-y-6">
      {/* Category: Reprodução */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <PlayCircle className="size-4 text-primary" />
            Reprodução
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
          {/* Autoplay Toggle */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="space-y-1">
              <Label
                htmlFor={`autoplay-switch-${videoId}`}
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Autoplay
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Inicia o vídeo automaticamente como uma reprodução normal. Alguns navegadores podem bloquear autoplay com áudio.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isPending && pendingField === "autoplay" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id={`autoplay-switch-${videoId}`}
                checked={config.playback.autoplay}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  handleConfigUpdate(
                    {
                      playback: {
                        autoplay: checked,
                      },
                    },
                    "autoplay"
                  )
                }
              />
            </div>
          </div>

          {/* Background Autoplay Toggle */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="space-y-1">
              <Label
                htmlFor={`background-autoplay-switch-${videoId}`}
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Background Autoplay
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mantém o vídeo reproduzindo automaticamente no mudo como fundo antes da interação do espectador. Essa reprodução não representa uma visualização real.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isPending && pendingField === "backgroundAutoplay" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id={`background-autoplay-switch-${videoId}`}
                checked={config.playback.backgroundAutoplay}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  handleConfigUpdate(
                    {
                      playback: {
                        backgroundAutoplay: checked,
                      },
                    },
                    "backgroundAutoplay"
                  )
                }
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
        <CardHeader className="p-4 sm:p-6 pb-3">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            Desenvolvimento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
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
