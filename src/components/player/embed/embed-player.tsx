"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { EvandroPlayer } from "../evandro-player";
import { AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { type PlayerConfig, DEFAULT_PLAYER_CONFIG, parsePlayerConfig } from "@/types/player-config";
import { markPerformance } from "./performance-timing";
import type { PlayerEngine } from "../engine/player-engine";

export interface EmbedPlayerProps {
  videoId: string;
  apiBase?: string;
  mediaElement?: HTMLVideoElement;
  engine?: PlayerEngine;
  stageElement?: HTMLElement;
}

interface EmbedVideoData {
  videoId: string;
  title: string;
  playbackUrl?: string | null;
  posterUrl?: string | null;
  backgroundPreviewUrl?: string | null;
  config: PlayerConfig;
}

type EmbedStatus = "loading" | "ready" | "not_found" | "error";

interface EmbedState {
  status: EmbedStatus;
  data: EmbedVideoData | null;
  errorMessage: string | null;
}

interface BootstrapResponsePayload {
  videoId?: string;
  title?: string;
  duration?: number | null;
  playbackUrl?: string | null;
  playback?: {
    type?: string;
    url?: string;
  };
  posterUrl?: string | null;
  backgroundPreviewUrl?: string | null;
  config?: unknown;
}

interface BootstrapError {
  status?: number;
  message?: string;
}

// Global shared bootstrap registry interface
declare global {
  interface Window {
    __EVANDRO_PLAYER_BOOTSTRAP__?: {
      map: Record<string, Promise<BootstrapResponsePayload>>;
      resolved: Record<string, BootstrapResponsePayload>;
      fetch: (apiBase: string, videoId: string) => Promise<BootstrapResponsePayload>;
      preconnect?: (url: string) => void;
      preloadVisual?: (url: string) => void;
      preloadHls?: () => void;
    };
  }
}

function parsePayloadToEmbedData(
  json: BootstrapResponsePayload,
  videoId: string
): EmbedVideoData {
  const playbackUrl = json.playback?.url || json.playbackUrl || null;
  const parsedConfig = json.config
    ? parsePlayerConfig(json.config)
    : DEFAULT_PLAYER_CONFIG;

  return {
    videoId: json.videoId || videoId,
    title: json.title || "",
    playbackUrl,
    posterUrl: json.posterUrl || null,
    backgroundPreviewUrl: json.backgroundPreviewUrl || null,
    config: parsedConfig,
  };
}

export function EmbedPlayer({
  videoId,
  apiBase,
  mediaElement,
  engine,
}: EmbedPlayerProps) {
  const base = (apiBase || "").replace(/\/$/, "");
  const cacheKey = `${base}:${videoId}`;

  // Synchronous hydration: check if Tiny Loader already resolved bootstrap before Core mounted
  const [state, setState] = useState<EmbedState>(() => {
    if (!videoId) {
      return {
        status: "not_found",
        data: null,
        errorMessage: "Identificador de vídeo não fornecido.",
      };
    }

    if (
      typeof window !== "undefined" &&
      window.__EVANDRO_PLAYER_BOOTSTRAP__?.resolved &&
      cacheKey in window.__EVANDRO_PLAYER_BOOTSTRAP__.resolved
    ) {
      const resolvedData = window.__EVANDRO_PLAYER_BOOTSTRAP__.resolved[cacheKey];
      return {
        status: "ready",
        data: parsePayloadToEmbedData(resolvedData, videoId),
        errorMessage: null,
      };
    }

    return {
      status: "loading",
      data: null,
      errorMessage: null,
    };
  });

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    markPerformance("ep:core:ready", videoId);

    // If state was already synchronously hydrated from resolved bootstrap cache on first render
    if (state.status === "ready" && retryCount === 0) {
      return;
    }

    const controller = new AbortController();

    async function executeBootstrap() {
      try {
        let jsonPromise: Promise<BootstrapResponsePayload>;

        // Consume in-flight bootstrap promise from tiny loader if present
        if (
          typeof window !== "undefined" &&
          window.__EVANDRO_PLAYER_BOOTSTRAP__?.map &&
          cacheKey in window.__EVANDRO_PLAYER_BOOTSTRAP__.map &&
          retryCount === 0
        ) {
          jsonPromise = window.__EVANDRO_PLAYER_BOOTSTRAP__.map[cacheKey];
        } else {
          markPerformance("ep:bootstrap:start", videoId);
          const url = `${base}/api/embed/videos/${encodeURIComponent(videoId)}`;

          jsonPromise = fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }).then(async (response) => {
            if (response.status === 403) {
              const errData = (await response.json().catch(() => ({}))) as { error?: string };
              const err: BootstrapError = { status: 403, message: errData.error || "Este vídeo está temporariamente indisponível." };
              throw err;
            }
            if (response.status === 404) {
              const errData = (await response.json().catch(() => ({}))) as { error?: string };
              const err: BootstrapError = { status: 404, message: errData.error || "Vídeo não encontrado ou indisponível." };
              throw err;
            }
            if (!response.ok) {
              const err: BootstrapError = { status: response.status, message: `HTTP error ${response.status}` };
              throw err;
            }
            return response.json() as Promise<BootstrapResponsePayload>;
          });

          if (typeof window !== "undefined" && window.__EVANDRO_PLAYER_BOOTSTRAP__) {
            window.__EVANDRO_PLAYER_BOOTSTRAP__.map[cacheKey] = jsonPromise;
          }
        }

        const json = await jsonPromise;
        markPerformance("ep:bootstrap:end", videoId);

        if (typeof window !== "undefined" && window.__EVANDRO_PLAYER_BOOTSTRAP__) {
          window.__EVANDRO_PLAYER_BOOTSTRAP__.resolved[cacheKey] = json;
        }

        // Preconnect provider origin dynamically once playbackUrl is resolved
        const playbackUrl = json.playback?.url || json.playbackUrl || null;
        if (playbackUrl && typeof window !== "undefined" && window.__EVANDRO_PLAYER_BOOTSTRAP__?.preconnect) {
          try {
            const providerOrigin = new URL(playbackUrl).origin;
            window.__EVANDRO_PLAYER_BOOTSTRAP__.preconnect(providerOrigin);
          } catch {
            // ignore malformed URL
          }
        }

        const parsedConfig = json.config
          ? parsePlayerConfig(json.config)
          : DEFAULT_PLAYER_CONFIG;

        // Warm up priority visual asset according to strict policy
        if (typeof window !== "undefined" && window.__EVANDRO_PLAYER_BOOTSTRAP__?.preloadVisual) {
          const isBg = Boolean(parsedConfig.playback?.backgroundAutoplay);
          const isThumbEnabled = parsedConfig.appearance?.thumbnail?.enabled ?? true;

          if (isBg && json.backgroundPreviewUrl) {
            window.__EVANDRO_PLAYER_BOOTSTRAP__.preloadVisual(json.backgroundPreviewUrl);
          } else if (!isBg && isThumbEnabled && json.posterUrl) {
            window.__EVANDRO_PLAYER_BOOTSTRAP__.preloadVisual(json.posterUrl);
          }
        }

        if (!controller.signal.aborted) {
          setState({
            status: "ready",
            data: {
              videoId: json.videoId || videoId,
              title: json.title || "",
              playbackUrl,
              posterUrl: json.posterUrl || null,
              backgroundPreviewUrl: json.backgroundPreviewUrl || null,
              config: parsedConfig,
            },
            errorMessage: null,
          });
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;

        console.error("[Evandro Player Embed] Failed to resolve video:", err);

        const typedErr = err as BootstrapError | undefined;

        if (typedErr?.status === 403) {
          setState({
            status: "error",
            data: null,
            errorMessage: typedErr.message || "Este vídeo está temporariamente indisponível.",
          });
        } else if (typedErr?.status === 404) {
          setState({
            status: "not_found",
            data: null,
            errorMessage: typedErr.message || "Vídeo não encontrado ou indisponível.",
          });
        } else {
          setState({
            status: "error",
            data: null,
            errorMessage: "Não foi possível carregar as informações do vídeo.",
          });
        }
      }
    }

    executeBootstrap();

    return () => {
      controller.abort();
    };
  }, [videoId, base, cacheKey, retryCount, state.status]);

  const handleRetry = () => {
    if (typeof window !== "undefined" && window.__EVANDRO_PLAYER_BOOTSTRAP__) {
      delete window.__EVANDRO_PLAYER_BOOTSTRAP__.map[cacheKey];
      delete window.__EVANDRO_PLAYER_BOOTSTRAP__.resolved[cacheKey];
    }
    setState({
      status: "loading",
      data: null,
      errorMessage: null,
    });
    setRetryCount((c) => c + 1);
  };

  const { status, data, errorMessage } = state;

  const aspectRatio = data?.config.appearance?.aspectRatio ?? "16:9";
  const aspectClass =
    aspectRatio === "9:16"
      ? "aspect-[9/16]"
      : aspectRatio === "1:1"
      ? "aspect-square"
      : "aspect-video";

  // Initial technical loading placeholder without spinner (stage & video exist underneath)
  if (status === "loading") {
    if (mediaElement) {
      return <div className="w-full h-full pointer-events-none" />;
    }
    return (
      <div
        className={cn(
          "relative w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-white/10 shadow-2xl mx-auto",
          aspectClass
        )}
      />
    );
  }

  if (status === "not_found") {
    return (
      <div
        className={cn(
          "relative w-full rounded-xl overflow-hidden bg-zinc-950 flex flex-col items-center justify-center text-center p-6 border border-white/10 shadow-2xl space-y-3 font-sans mx-auto",
          aspectClass
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
          aspectClass
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
    <EvandroPlayer
      src={data.playbackUrl || undefined}
      apiBase={apiBase}
      posterUrl={data.posterUrl}
      backgroundPreviewUrl={data.backgroundPreviewUrl}
      videoId={data.videoId}
      title={data.title}
      config={data.config}
      debugEnabled={data.config.development.debug}
      mediaElement={mediaElement}
      engine={engine}
    />
  );
}
