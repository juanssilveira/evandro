"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { WatchMapPlayer } from "../watchmap-player";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { type PlayerConfig, DEFAULT_PLAYER_CONFIG, parsePlayerConfig } from "@/types/player-config";

export interface EmbedPlayerProps {
  videoId: string;
  apiBase?: string;
}

interface EmbedVideoData {
  videoId: string;
  title: string;
  playbackUrl: string;
  config: PlayerConfig;
}

type EmbedStatus = "loading" | "ready" | "not_found" | "error";

interface EmbedState {
  status: EmbedStatus;
  data: EmbedVideoData | null;
  errorMessage: string | null;
}

export function EmbedPlayer({ videoId, apiBase }: EmbedPlayerProps) {
  const [state, setState] = useState<EmbedState>(() => ({
    status: videoId ? "loading" : "not_found",
    data: null,
    errorMessage: videoId ? null : "Identificador de vídeo não fornecido.",
  }));
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    const controller = new AbortController();

    async function fetchEmbedData() {
      try {
        const base = (apiBase || "").replace(/\/$/, "");
        const url = `${base}/api/embed/videos/${encodeURIComponent(videoId)}`;

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 404) {
          if (!controller.signal.aborted) {
            setState({
              status: "not_found",
              data: null,
              errorMessage: "Vídeo não encontrado ou indisponível.",
            });
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const json = await response.json();

        if (!json.playbackUrl) {
          throw new Error("Invalid embed payload: missing playbackUrl");
        }

        const parsedConfig = json.config
          ? parsePlayerConfig(json.config)
          : DEFAULT_PLAYER_CONFIG;

        if (!controller.signal.aborted) {
          setState({
            status: "ready",
            data: {
              videoId: json.videoId || videoId,
              title: json.title || "",
              playbackUrl: json.playbackUrl,
              config: parsedConfig,
            },
            errorMessage: null,
          });
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;

        console.error("[WatchMap Embed] Failed to resolve video:", err);
        setState({
          status: "error",
          data: null,
          errorMessage: "Não foi possível carregar as informações do vídeo.",
        });
      }
    }

    fetchEmbedData();

    return () => {
      controller.abort();
    };
  }, [videoId, apiBase, retryCount]);

  const handleRetry = () => {
    setState({
      status: "loading",
      data: null,
      errorMessage: null,
    });
    setRetryCount((c) => c + 1);
  };

  const { status, data, errorMessage } = state;

  const isVertical = data?.config.appearance?.aspectRatio === "9:16";

  if (status === "loading") {
    return (
      <div
        className={cn(
          "relative w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-white/10 shadow-2xl mx-auto",
          isVertical ? "aspect-[9/16] max-w-[480px]" : "aspect-[16/9] max-w-[680px]"
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-md shadow-lg border border-white/10">
          <Loader2 className="size-6 animate-spin text-[#7C3AED]" />
        </div>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div
        className={cn(
          "relative w-full rounded-xl overflow-hidden bg-zinc-950 flex flex-col items-center justify-center text-center p-6 border border-white/10 shadow-2xl space-y-3 font-sans mx-auto",
          isVertical ? "aspect-[9/16] max-w-[480px]" : "aspect-[16/9] max-w-[680px]"
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="size-6 text-red-500" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="font-semibold text-white text-sm sm:text-base">
            Vídeo não encontrado
          </h3>
          <p className="text-xs text-zinc-400">
            {errorMessage || "O vídeo solicitado não existe ou foi removido."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div
        className={cn(
          "relative w-full rounded-xl overflow-hidden bg-zinc-950 flex flex-col items-center justify-center text-center p-6 border border-white/10 shadow-2xl space-y-3 font-sans mx-auto",
          isVertical ? "aspect-[9/16] max-w-[480px]" : "aspect-[16/9] max-w-[680px]"
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <AlertCircle className="size-6 text-amber-500" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="font-semibold text-white text-sm sm:text-base">
            Falha na reprodução
          </h3>
          <p className="text-xs text-zinc-400">
            {errorMessage || "Ocorreu um erro ao carregar o vídeo. Verifique sua conexão e tente novamente."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10 cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <WatchMapPlayer
      src={data.playbackUrl}
      videoId={data.videoId}
      title={data.title}
      config={data.config}
      debugEnabled={data.config.development.debug}
    />
  );
}
