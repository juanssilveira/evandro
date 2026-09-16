"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { updateVideoDebugAction } from "@/app/actions/videos";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sliders, Loader2 } from "lucide-react";

interface VideoSettingsProps {
  videoId: string;
  debugEnabled: boolean;
  onDebugChange: (enabled: boolean) => void;
}

export function VideoSettings({
  videoId,
  debugEnabled,
  onDebugChange,
}: VideoSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (checked: boolean) => {
    const previous = debugEnabled;
    onDebugChange(checked);
    setError(null);

    startTransition(async () => {
      const result = await updateVideoDebugAction({
        videoId,
        debugEnabled: checked,
      });

      if (result.error) {
        onDebugChange(previous);
        setError(result.error);
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
              checked={debugEnabled}
              disabled={isPending}
              onCheckedChange={handleToggle}
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
