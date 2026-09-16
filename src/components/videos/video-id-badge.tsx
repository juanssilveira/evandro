"use client";

import { useState } from "react";
import { Copy, Check, Hash } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface VideoIdBadgeProps {
  publicId: string;
}

export function VideoIdBadge({ publicId }: VideoIdBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = publicId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copiar ID público do vídeo"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 hover:bg-muted/80 border border-border/60 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer group shadow-2xs select-none"
          />
        }
      >
        <Hash className="size-2.5 text-muted-foreground/70 shrink-0" />
        <span className="font-mono text-muted-foreground/90 group-hover:text-foreground transition-colors font-medium">
          {publicId}
        </span>
        {copied ? (
          <Check className="size-2.5 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.5]" />
        ) : (
          <Copy className="size-2.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
        )}
      </TooltipTrigger>

      <TooltipContent side="bottom" align="end" className="text-[11px]">
        {copied ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="size-3 stroke-[2.5]" /> Copiado para a área de transferência
          </span>
        ) : (
          <span>ID público • Clique para copiar</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
