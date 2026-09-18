"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Code2, Copy, Check, Info, Bug, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updatePlayerConfigAction } from "@/app/actions/videos";
import type { PlayerConfig } from "@/types/player-config";

interface VideoEmbedCardProps {
  publicId: string;
  cdnUrl: string;
  videoId: string;
  config: PlayerConfig;
  onConfigChange: (config: PlayerConfig) => void;
}

export function VideoEmbedCard({
  publicId,
  cdnUrl,
  videoId,
  config,
  onConfigChange,
}: VideoEmbedCardProps) {
  const [copiedPlayer, setCopiedPlayer] = useState(false);
  const [copiedHead, setCopiedHead] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cleanCdnUrl = cdnUrl.replace(/\/$/, "");

  const aspectRatio = config.appearance?.aspectRatio === "9:16"
    ? "9/16"
    : config.appearance?.aspectRatio === "1:1"
    ? "1/1"
    : "16/9";
  const borderRadius = config.appearance?.borderRadius ?? 12;

  const playerEmbedCode = `<watchmap-player\n  video-id="${publicId}"\n  style="display:block;width:100%;aspect-ratio:${aspectRatio};background:#000;border-radius:${borderRadius}px;overflow:hidden;"\n></watchmap-player>\n<script src="${cleanCdnUrl}/embed/v1/watchmap-player.js" async fetchpriority="high"></script>`;

  const headOptimizationCode = `<link rel="preconnect" href="${cleanCdnUrl}">\n<link rel="preconnect" href="${cleanCdnUrl}" crossorigin>\n<link rel="dns-prefetch" href="${cleanCdnUrl}">\n<link\n  rel="preload"\n  href="${cleanCdnUrl}/embed/v1/watchmap-player.js"\n  as="script"\n  fetchpriority="high"\n>`;

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
      const textarea = document.createElement("textarea");
      textarea.value = text;
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
    <Card className="border border-dashed border-border/90 bg-zinc-50/50 dark:bg-zinc-900/20 shadow-xs rounded-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-dashed border-border/70 bg-zinc-100/40 dark:bg-zinc-900/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Code2 className="size-4 text-foreground/80" />
            Código de Embed
          </CardTitle>
          {/* WatchMap Player Technical Version Chip */}
          <span
            className="watchmap-badge relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider select-none overflow-hidden cursor-default"
            style={{
              background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 40%, #4f46e5 100%)",
              boxShadow:
                "0 1px 0 0 rgba(255,255,255,0.18) inset, 0 -1px 0 0 rgba(0,0,0,0.25) inset, 0 2px 6px -1px rgba(109,40,217,0.55), 0 1px 2px -1px rgba(79,70,229,0.4)",
              border: "1px solid rgba(167,139,250,0.35)",
            }}
          >
            {/* Gloss top highlight */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-t-full"
              style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)",
              }}
            />
            {/* Shimmer sweep */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
                animation: "wm-shimmer 2.8s ease-in-out infinite",
              }}
            />
            {/* Dot indicator */}
            <span
              aria-hidden
              className="relative size-1.5 rounded-full shrink-0"
              style={{
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 0 4px 1px rgba(167,139,250,0.7)",
              }}
            />
            <span className="relative text-white/95" style={{ letterSpacing: "0.06em" }}>
              WM Player v1.0
            </span>
            <style>{`
              @keyframes wm-shimmer {
                0%   { background-position: 200% center; }
                60%  { background-position: -200% center; }
                100% { background-position: -200% center; }
              }
            `}</style>
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Incorpore o player em qualquer página HTML através do elemento customizado com Shadow DOM isolado e carregamento ultra-rápido.
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Main Player Code Box */}
        <div className="rounded-lg border border-dashed border-border/80 bg-background/80 dark:bg-zinc-950/40 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              Código do Player
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(playerEmbedCode, setCopiedPlayer)}
              className="h-7 px-2.5 text-xs font-medium gap-1.5 shrink-0 cursor-pointer shadow-2xs hover:bg-muted"
            >
              {copiedPlayer ? (
                <>
                  <Check className="size-3 text-emerald-500 stroke-[2.5]" />
                  <span className="text-emerald-500 font-semibold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3 text-muted-foreground" />
                  <span>Copiar</span>
                </>
              )}
            </Button>
          </div>

          <div className="relative rounded-lg bg-zinc-950 dark:bg-black px-3.5 py-2.5 border border-zinc-800/80 font-mono text-[11px] text-zinc-300 overflow-x-auto select-all leading-relaxed shadow-inner whitespace-pre">
            {playerEmbedCode}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cole onde o vídeo deve aparecer na página.
          </p>
        </div>

        {/* Head Optimization Code Box */}
        <div className="rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 dark:bg-violet-950/10 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="size-3.5 text-violet-500 fill-violet-500/20" />
                Otimização de carregamento
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25">
                Recomendado
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(headOptimizationCode, setCopiedHead)}
              className="h-7 px-2.5 text-xs font-medium gap-1.5 shrink-0 cursor-pointer shadow-2xs hover:bg-muted"
            >
              {copiedHead ? (
                <>
                  <Check className="size-3 text-emerald-500 stroke-[2.5]" />
                  <span className="text-emerald-500 font-semibold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3 text-muted-foreground" />
                  <span>Copiar</span>
                </>
              )}
            </Button>
          </div>

          <div className="relative rounded-lg bg-zinc-950 dark:bg-black px-3.5 py-2.5 border border-zinc-800/80 font-mono text-[11px] text-zinc-300 overflow-x-auto select-all leading-relaxed shadow-inner whitespace-pre">
            {headOptimizationCode}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cole no <code className="text-violet-500 dark:text-violet-400 font-mono bg-background px-1 py-0.5 rounded border border-border/50 text-[10px]">&lt;head&gt;</code> para antecipar conexões DNS e preload do loader antes do body.
          </p>
        </div>

        {/* Instructions */}
        <div className="flex items-start gap-2.5 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/40 border border-dashed border-border/70 p-3 sm:p-3.5 text-[11px] text-muted-foreground">
          <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="leading-normal">
            O player inicia o bootstrap do vídeo e o download dos componentes em paralelo imediatamente, garantindo reprodução instantânea com zero layout shift.
          </p>
        </div>

        {/* Sub-section: Testes e Debug */}
        <div className="pt-4 sm:pt-5 border-t border-dashed border-border/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-foreground/85">
              <Bug className="size-3.5 text-amber-500 dark:text-amber-400" />
              <span className="text-xs font-semibold tracking-tight">
                Testes e Debug
              </span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wide">
              Apenas para Testes
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border/80 bg-background/80 dark:bg-zinc-950/40 p-3.5 sm:p-4">
            <div className="space-y-1">
              <Label
                htmlFor={`embed-debug-switch-${videoId}`}
                className="text-xs font-semibold text-foreground cursor-pointer block"
              >
                Debug do Player Runtime & Métricas de Performance
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Exibe no console os marcos de timing (Bootstrap, Core Ready, Manifest, First Frame, Click → Frame).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
