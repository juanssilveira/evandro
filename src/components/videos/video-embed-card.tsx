"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Code2, Copy, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoEmbedCardProps {
  publicId: string;
  baseUrl: string;
}

export function VideoEmbedCard({ publicId, baseUrl }: VideoEmbedCardProps) {
  const [copied, setCopied] = useState(false);

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

  return (
    <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3">
        {/* Header & Copy Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
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
          <div className="text-zinc-200">{`<script src="${cleanBaseUrl}/embed/v1/watchmap-player.js" defer></script>`}</div>
          <div className="text-primary-foreground/90">{`<watchmap-player video-id="${publicId}"></watchmap-player>`}</div>
        </div>

        {/* Instructions */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border/40 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
          <p className="leading-normal">
            Cole a tag <code className="text-foreground font-mono bg-muted/80 px-1 py-0.5 rounded text-[10px]">&lt;script&gt;</code> no cabeçalho e <code className="text-foreground font-mono bg-muted/80 px-1 py-0.5 rounded text-[10px]">&lt;watchmap-player&gt;</code> onde deseja exibir o vídeo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
