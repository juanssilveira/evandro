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
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Header & Copy Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Code2 className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Código de Embed
              </h3>
              <p className="text-xs text-muted-foreground">
                Incorpore este player em qualquer página externa isolado por Shadow DOM.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8.5 px-3.5 text-xs font-medium gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-semibold">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-muted-foreground" />
                <span>Copiar código</span>
              </>
            )}
          </Button>
        </div>

        {/* Code Snippet Box */}
        <div className="relative rounded-lg bg-zinc-950 p-3.5 border border-border/50 font-mono text-xs text-zinc-300 overflow-x-auto select-all leading-relaxed">
          <div className="text-zinc-200">{`<script src="${cleanBaseUrl}/embed/v1/watchmap-player.js" defer></script>`}</div>
          <div className="text-primary-foreground/90">{`<watchmap-player video-id="${publicId}"></watchmap-player>`}</div>
        </div>

        {/* Instructions */}
        <div className="flex items-start gap-2.5 rounded-lg bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground">
          <Info className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              Como instalar no seu site:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-[11px] leading-relaxed">
              <li>
                Cole a tag <code className="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded">&lt;script&gt;</code> dentro da tag <code className="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded">&lt;head&gt;</code> ou antes do fechamento do <code className="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded">&lt;/body&gt;</code>.
              </li>
              <li>
                Posicione a tag <code className="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded">&lt;watchmap-player&gt;</code> no local exato do layout onde deseja que o vídeo seja exibido.
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
