"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Code2, Copy, Check, Info, Bug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updatePlayerConfigAction } from "@/app/actions/videos";
import type { PlayerConfig } from "@/types/player-config";

interface VideoEmbedCardProps {
  publicId: string;
  baseUrl: string;
  videoId: string;
  config: PlayerConfig;
  onConfigChange: (config: PlayerConfig) => void;
}

export function VideoEmbedCard({
  publicId,
  baseUrl,
  videoId,
  config,
  onConfigChange,
}: VideoEmbedCardProps) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const embedCode = `<script src="${cleanBaseUrl}/embed/v1/watchmap-player.js" defer></script>\n<watchmap-player video-id="${publicId}"></watchmap-player>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
      const textarea = document.createElement("textarea");
      textarea.value = embedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
    <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Header & Copy Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border shrink-0">
              <Code2 className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Código de Embed
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Shadow DOM isolado • Sem dependências externas
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-3 text-xs font-medium gap-1.5 shrink-0 cursor-pointer shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500 stroke-[2.5]" />
                <span className="text-emerald-500 font-semibold">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-muted-foreground" />
                <span>Copiar</span>
              </>
            )}
          </Button>
        </div>

        {/* Code Snippet Box */}
        <div className="relative rounded-lg bg-zinc-950 px-3.5 py-2.5 border border-border/50 font-mono text-[11px] text-zinc-300 overflow-x-auto select-all leading-relaxed">
          <div className="text-zinc-400">{`<script src="${cleanBaseUrl}/embed/v1/watchmap-player.js" defer></script>`}</div>
          <div className="text-zinc-200">{`<watchmap-player video-id="${publicId}"></watchmap-player>`}</div>
        </div>

        {/* Instructions */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border/40 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="leading-normal">
            Cole a tag <code className="text-foreground font-mono bg-muted/80 px-1 py-0.5 rounded text-[10px]">&lt;script&gt;</code> no cabeçalho e <code className="text-foreground font-mono bg-muted/80 px-1 py-0.5 rounded text-[10px]">&lt;watchmap-player&gt;</code> onde deseja exibir o vídeo.
          </p>
        </div>

        {/* Sub-section: Testes e Debug */}
        <div className="pt-3 border-t border-border/50 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bug className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Testes e Debug
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Diagnóstico
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:p-3">
            <div className="space-y-0.5">
              <Label
                htmlFor={`embed-debug-switch-${videoId}`}
                className="text-xs font-medium text-foreground cursor-pointer"
              >
                Debug do Player Runtime
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Registra eventos do ciclo de vida no console do DevTools.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {isPending && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
              <Switch
                id={`embed-debug-switch-${videoId}`}
                checked={config.development?.debug ?? false}
                disabled={isPending}
                onCheckedChange={handleDebugToggle}
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-destructive font-medium">{error}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
