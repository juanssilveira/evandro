"use client";

import { useState } from "react";
import { Copy, Check, Hash } from "lucide-react";

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
    <button
      type="button"
      onClick={handleCopy}
      title="Clique para copiar o ID do vídeo"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted border border-border/80 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer group shadow-2xs select-none"
    >
      <Hash className="size-3 text-primary shrink-0" />
      <span className="font-semibold text-foreground/90">{publicId}</span>
      {copied ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold text-emerald-600 dark:text-emerald-400 ml-0.5">
          <Check className="size-3 stroke-[2.5]" />
          <span>Copiado</span>
        </span>
      ) : (
        <Copy className="size-3 text-muted-foreground group-hover:text-foreground transition-colors ml-0.5" />
      )}
    </button>
  );
}
