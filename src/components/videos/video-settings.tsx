"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { updatePlayerConfigAction } from "@/app/actions/videos";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sliders, Loader2 } from "lucide-react";
import type { PlayerConfig } from "@/types/player-config";

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
  const [error, setError] = useState<string | null>(null);

  const handleDebugToggle = (checked: boolean) => {
    const previousConfig = config;
    const nextConfig: PlayerConfig = {
      ...config,
      development: {
        ...config.development,
        debug: checked,
      },
    };

    onConfigChange(nextConfig);
    setError(null);

    startTransition(async () => {
      const result = await updatePlayerConfigAction({
        videoId,
        config: {
          development: {
            debug: checked,
          },
        },
      });

      if (result.error) {
        onConfigChange(previousConfig);
        setError(result.error);
      } else if (result.config) {
        onConfigChange(result.config as PlayerConfig);
      }
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-6 pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Sliders className="size-4 text-primary" />
          Configurações do vídeo
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
            {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <Switch
              id={`debug-switch-${videoId}`}
              checked={config.development.debug}
              disabled={isPending}
              onCheckedChange={handleDebugToggle}
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive font-medium">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
