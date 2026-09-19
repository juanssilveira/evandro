/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Loader2,
  AlertCircle,
  Gauge,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PlayerRuntime,
  type PlayerEventListener,
  type FullscreenInitiator,
  type PlaybackMode,
} from "./runtime";
import {
  type PlayerConfig,
  DEFAULT_PLAYER_CONFIG,
  PLAYER_ACCENT_PRESETS,
} from "@/types/player-config";
import { calculateFakeProgress } from "@/lib/player/fake-progress-engine";
import { MediaLoadingStateManager } from "./embed/media-loading-state";
import {
  markPerformance,
} from "./embed/performance-timing";
import { PlayerEngine } from "./engine/player-engine";
import { resolveStartupVisualFromConfig } from "./engine/startup-visual-resolver";

export interface EvandroPlayerProps {
  src?: string;
  videoId?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  posterUrl?: string | null;
  backgroundPreviewUrl?: string | null;
  isEditor?: boolean;
  apiBase?: string;
  config?: PlayerConfig;
  debugEnabled?: boolean;
  mediaElement?: HTMLVideoElement;
  engine?: PlayerEngine;
  onEvent?: PlayerEventListener;
  onRuntimeReady?: (runtime: PlayerRuntime) => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function EvandroPlayer({
  src,
  videoId = "default-video",
  title,
  className,
  posterUrl,
  backgroundPreviewUrl,
  isEditor = false,
  apiBase,
  config = DEFAULT_PLAYER_CONFIG,
  debugEnabled,
  mediaElement,
  engine: externalEngine,
  onEvent,
  onRuntimeReady,
}: EvandroPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startupVisualRef = useRef<HTMLDivElement | null>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const [internalEngine, setInternalEngine] = useState<PlayerEngine | null>(null);

  const activeEngine = externalEngine || internalEngine;

  const progressTrackRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<PlayerRuntime | null>(null);

  const resolvedSrc = src || "";

  // Play session ID for server-side activation and quota tracking
  const playSessionIdRef = useRef<string | null>(null);
  const getPlaySessionId = useCallback(() => {
    if (!playSessionIdRef.current) {
      playSessionIdRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    return playSessionIdRef.current;
  }, []);

  // Effective configuration
  const effectiveConfig = React.useMemo<PlayerConfig>(
    () => ({
      ...config,
      appearance: {
        ...config.appearance,
        borderRadius: config.appearance?.borderRadius ?? 12,
      },
      playback: {
        ...config.playback,
        autoplay: false,
        backgroundAutoplay: config.playback?.backgroundAutoplay ?? false,
      },
      controls: {
        ...config.controls,
        hidden: config.controls?.hidden ?? false,
        fullscreen: {
          enabled: config.controls?.fullscreen?.enabled ?? true,
          button: config.controls?.fullscreen?.button ?? true,
          doubleClick: config.controls?.fullscreen?.doubleClick ?? true,
          keyboardF: config.controls?.fullscreen?.keyboardF ?? true,
        },
      },
      progress: {
        fake: {
          enabled: config.progress?.fake?.enabled ?? false,
          height: config.progress?.fake?.height ?? 4,
          color: config.progress?.fake?.color ?? "accent",
        },
      },
      development: {
        ...config.development,
        debug: debugEnabled ?? config.development?.debug ?? false,
      },
    }),
    [config, debugEnabled]
  );

  const accentPreset =
    PLAYER_ACCENT_PRESETS[effectiveConfig.appearance?.accentColor ?? "purple"] ??
    PLAYER_ACCENT_PRESETS.purple;

  const accentStyle = React.useMemo<React.CSSProperties>(
    () =>
      ({
        "--player-accent": accentPreset.tokens.base,
        "--player-accent-hover": accentPreset.tokens.hover,
        "--player-accent-active": accentPreset.tokens.active,
        "--player-accent-soft": accentPreset.tokens.soft,
        "--player-accent-foreground": accentPreset.tokens.foreground,
      } as React.CSSProperties),
    [accentPreset]
  );

  const effectiveDebug = effectiveConfig.development.debug;
  const isControlsHidden = effectiveConfig.controls.hidden;
  const fullscreenConfig = effectiveConfig.controls.fullscreen;

  // State Machine Manager for Media Loading & UI Spinner
  const [isLoading, setIsLoading] = useState(false);
  const [mediaStateManager] = useState(
    () =>
      new MediaLoadingStateManager((snapshot) => {
        setIsLoading(snapshot.showSpinner);
      })
  );

  // Playback state derived from authoritative PlayerEngine
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(effectiveConfig.playback?.defaultVolume ?? 1);
  const [isMuted, setIsMuted] = useState((effectiveConfig.playback?.defaultVolume ?? 1) === 0);
  const [playbackRate, setPlaybackRate] = useState(effectiveConfig.playback?.defaultPlaybackRate ?? 1);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [hasStartedForeground, setHasStartedForeground] = useState(false);
  const [userActivatedForeground, setUserActivatedForeground] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [pauseThumbError, setPauseThumbError] = useState(false);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const lastVolumeRef = useRef(effectiveConfig.playback?.defaultVolume ?? 1);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create internal PlayerEngine for Editor & Standalone mode
  useEffect(() => {
    if (externalEngine || mediaElement) return;

    const videoEl = internalVideoRef.current;
    if (!videoEl) return;

    const eng = new PlayerEngine({
      videoElement: videoEl,
      startupVisualElement: startupVisualRef.current,
      debug: effectiveDebug,
    });

    setInternalEngine(eng);

    return () => {
      eng.destroy();
      setInternalEngine(null);
    };
  }, [externalEngine, mediaElement, effectiveDebug]);

  // Pass startupVisual element to engine if attached after mount
  useEffect(() => {
    if (activeEngine && startupVisualRef.current) {
      activeEngine.setStartupVisualElement(startupVisualRef.current);
    }
  }, [activeEngine]);

  // Load source into internal Engine or update external Engine config
  useEffect(() => {
    if (!activeEngine) return;

    if (!externalEngine) {
      // Editor / Standalone mode: React manages loadSource on internal engine
      if (resolvedSrc) {
        activeEngine.loadSource({
          videoId,
          playbackUrl: resolvedSrc,
          backgroundAutoplay: Boolean(effectiveConfig.playback?.backgroundAutoplay),
          thumbnailEnabled: effectiveConfig.appearance?.thumbnail?.enabled ?? true,
          posterUrl,
          backgroundPreviewUrl,
          config: effectiveConfig,
          defaultVolume: effectiveConfig.playback?.defaultVolume ?? 1,
          defaultPlaybackRate: effectiveConfig.playback?.defaultPlaybackRate ?? 1,
          apiBase,
        });
      }
    } else {
      // Embed mode: Tiny Loader already started loadSource; update live config if changed
      activeEngine.updateConfig(effectiveConfig);
    }
  }, [
    activeEngine,
    externalEngine,
    resolvedSrc,
    videoId,
    effectiveConfig,
    posterUrl,
    backgroundPreviewUrl,
    apiBase,
  ]);

  // Subscribe to authoritative PlayerEngine state
  useEffect(() => {
    if (!activeEngine) return;

    const unsubscribe = activeEngine.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setVolume(state.volume);
      setIsMuted(state.isMuted);
      if (state.volume > 0 && !state.isMuted) {
        lastVolumeRef.current = state.volume;
      }
      setPlaybackRate(state.playbackRate);
      if (!isDraggingSeek) {
        setCurrentTime(state.currentTime);
      }
      if (Number.isFinite(state.duration)) {
        setDuration(state.duration);
      }
      setBufferedEnd(state.bufferedEnd);
      setHasFirstFrame(state.hasFirstFrame);
      setHasStartedForeground(state.hasStartedForeground);
      setUserActivatedForeground(
        state.userForegroundRequested || state.experience === "foreground"
      );
      setIsEnded(state.isEnded);
      setHasError(state.hasError);

      if (state.isBuffering) {
        mediaStateManager.onWaiting();
      } else {
        mediaStateManager.onCanPlay();
      }

      if (state.hasFirstFrame) {
        mediaStateManager.onFirstFrame();
      }

      if (state.isPlaying) {
        mediaStateManager.onPlaying();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeEngine, isDraggingSeek, mediaStateManager]);

  // Initialize PlayerRuntime lifecycle (strictly as Observer)
  useEffect(() => {
    const video = activeEngine?.video || mediaElement || internalVideoRef.current;
    const container = containerRef.current;
    if (!video) return;

    const runtime = new PlayerRuntime(video, {
      videoId,
      debug: effectiveDebug,
      containerElement: container,
    });

    runtimeRef.current = runtime;

    let unsubscribe: (() => void) | undefined;
    if (onEvent) {
      unsubscribe = runtime.subscribe(onEvent);
    }

    onRuntimeReady?.(runtime);

    return () => {
      runtimeRef.current = null;
      unsubscribe?.();
      runtime.destroy();
    };
  }, [activeEngine, mediaElement, videoId, effectiveDebug, onEvent, onRuntimeReady]);

  // 60fps smooth progress update loop while playing
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      const v = activeEngine?.video;
      if (v && !isDraggingSeek) {
        setCurrentTime(v.currentTime);
      }
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(loop);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, isDraggingSeek, activeEngine]);

  // Dynamic experience mode
  const isEmbedded = Boolean(mediaElement || externalEngine);
  const playbackMode: PlaybackMode =
    activeEngine?.state.experience === "background_autoplay" ||
    (effectiveConfig.playback?.backgroundAutoplay && !userActivatedForeground)
      ? "background_autoplay"
      : "foreground";

  // Thumbnails configuration & presentation
  const thumbConfig = effectiveConfig.appearance?.thumbnail;
  const showStartupPlayButton = thumbConfig?.showPlayButton ?? true;
  const pauseConfig = effectiveConfig.appearance?.pauseThumbnail;
  const isPauseThumbActive = Boolean(
    pauseConfig?.enabled && pauseConfig?.customUrl && !pauseThumbError
  );

  const initialVisual = useMemo(() => {
    if (isEmbedded) return null;
    return resolveStartupVisualFromConfig({
      config: effectiveConfig,
      posterUrl,
      backgroundPreviewUrl,
      apiBase,
    });
  }, [isEmbedded, effectiveConfig, posterUrl, backgroundPreviewUrl, apiBase]);

  const isStartupReady =
    effectiveConfig.appearance?.thumbnail?.enabled === false ||
    !isEmbedded ||
    hasFirstFrame ||
    (activeEngine?.state.startupVisualState !== "available" && activeEngine?.state.startupVisualState !== undefined);

  // Autohide controls logic
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (isPlaying && !showSettings && !isDraggingSeek && !isDraggingVolume) {
      hideTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying, showSettings, isDraggingSeek, isDraggingVolume]);

  const handleMouseMove = () => {
    if (playbackMode === "background_autoplay") return;
    showControlsTemporarily();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSettings && !isDraggingSeek && !isDraggingVolume) {
      setControlsVisible(false);
    }
  };

  // Background play tracking session
  const hasActivatedSessionRef = useRef(false);
  useEffect(() => {
    hasActivatedSessionRef.current = false;
  }, [src, videoId]);

  const activateSession = useCallback(() => {
    if (hasActivatedSessionRef.current) return;
    hasActivatedSessionRef.current = true;

    try {
      const base = (apiBase || "").replace(/\/$/, "");
      const activateEndpoint = `${base}/api/embed/videos/${encodeURIComponent(videoId)}/activate`;
      fetch(activateEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          playSessionId: getPlaySessionId(),
          isEditor: Boolean(isEditor),
        }),
      }).catch((err) => {
        console.warn("[Evandro Player] Background play tracking network error:", err);
      });
    } catch (err) {
      console.warn("[Evandro Player] Background play tracking failed:", err);
    }
  }, [apiBase, videoId, getPlaySessionId, isEditor]);

  // Main foreground playback activation
  const activateForegroundPlayback = useCallback(async () => {
    if (!activeEngine) return;

    markPerformance("ep:user-play", videoId);
    mediaStateManager.onPlayRequested();

    const targetVol =
      lastVolumeRef.current > 0
        ? lastVolumeRef.current
        : (effectiveConfig.playback?.defaultVolume ?? 1);

    activateSession();
    await activeEngine.startForeground(targetVol);
  }, [activeEngine, videoId, mediaStateManager, effectiveConfig, activateSession]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!activeEngine) return;

    if (playbackMode === "background_autoplay" || !userActivatedForeground) {
      activateForegroundPlayback();
      return;
    }

    markPerformance("ep:user-play", videoId);

    // If playing muted due to autoplay fallback, un-mute with audio
    if (isPlaying && (activeEngine.video.muted || isMuted)) {
      const restored =
        lastVolumeRef.current > 0
          ? lastVolumeRef.current
          : (effectiveConfig.playback?.defaultVolume ?? 1);
      activeEngine.setMuted(false);
      activeEngine.setVolume(restored);
      return;
    }

    if (isPlaying) {
      activeEngine.pause();
    } else {
      activateSession();
      mediaStateManager.onPlayRequested();
      activeEngine.play("user");
    }
  }, [
    activeEngine,
    playbackMode,
    userActivatedForeground,
    isPlaying,
    isMuted,
    effectiveConfig,
    activateForegroundPlayback,
    activateSession,
    videoId,
    mediaStateManager,
  ]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    if (!activeEngine) return;

    if (playbackMode === "background_autoplay") {
      activateForegroundPlayback();
      return;
    }

    if (isMuted || volume === 0) {
      const restored =
        lastVolumeRef.current > 0
          ? lastVolumeRef.current
          : (effectiveConfig.playback?.defaultVolume ?? 1);
      activeEngine.setMuted(false);
      activeEngine.setVolume(restored);
    } else {
      lastVolumeRef.current = volume > 0 ? volume : 1;
      activeEngine.setMuted(true);
    }
  }, [activeEngine, playbackMode, isMuted, volume, effectiveConfig, activateForegroundPlayback]);

  // Volume slider interaction
  const updateVolumeFromPosition = useCallback(
    (clientX: number) => {
      const track = volumeTrackRef.current;
      if (!track || !activeEngine) return;

      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return;
      const rawVol = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newVol = Math.round(rawVol * 100) / 100;

      activeEngine.setVolume(newVol);
      if (newVol > 0) {
        lastVolumeRef.current = newVol;
      }
    },
    [activeEngine]
  );

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingVolume(true);
    updateVolumeFromPosition(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateVolumeFromPosition(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDraggingVolume(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      showControlsTemporarily();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Playback rate
  const handleRateChange = (rate: number) => {
    if (!activeEngine) return;
    activeEngine.setPlaybackRate(rate);
    setShowSettings(false);
  };

  // Seek interaction
  const seekToPosition = (clientX: number) => {
    const track = progressTrackRef.current;
    if (!track || !activeEngine || !duration) return;

    const rect = track.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;

    activeEngine.seek(targetTime);
    setCurrentTime(targetTime);
  };

  const handleSeekMouseDown = (e: React.MouseEvent) => {
    setIsDraggingSeek(true);
    seekToPosition(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      seekToPosition(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDraggingSeek(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Fullscreen toggle
  const toggleFullscreen = useCallback(
    (initiator: FullscreenInitiator = "button") => {
      if (!fullscreenConfig.enabled) return;
      if (initiator === "button" && !fullscreenConfig.button) return;
      if (initiator === "double_click" && !fullscreenConfig.doubleClick) return;
      if (initiator === "keyboard" && !fullscreenConfig.keyboardF) return;

      const container = containerRef.current;
      if (!container) return;

      if (runtimeRef.current) {
        runtimeRef.current.setPendingFullscreenInitiator(initiator);
      }

      if (!document.fullscreenElement) {
        container.requestFullscreen?.().catch((err) => {
          console.error("Fullscreen error:", err);
          runtimeRef.current?.clearPendingFullscreenInitiator();
        });
      } else {
        document.exitFullscreen?.().catch((err) => {
          console.error("Exit fullscreen error:", err);
          runtimeRef.current?.clearPendingFullscreenInitiator();
        });
      }
    },
    [fullscreenConfig]
  );

  const handleContainerDoubleClick = (e: React.MouseEvent) => {
    if (!fullscreenConfig.enabled || !fullscreenConfig.doubleClick) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("[role='button']") ||
      target.closest("[role='slider']") ||
      target.closest("[data-no-fullscreen]") ||
      target.closest(".group\\/track") ||
      target.closest(".group\\/volume")
    ) {
      return;
    }

    toggleFullscreen("double_click");
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
        showControlsTemporarily();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen("keyboard");
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
        showControlsTemporarily();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (activeEngine) {
          activeEngine.seek(Math.max(0, activeEngine.state.currentTime - 5));
        }
        showControlsTemporarily();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (activeEngine) {
          activeEngine.seek(Math.min(duration, activeEngine.state.currentTime + 5));
        }
        showControlsTemporarily();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeEngine, duration, showControlsTemporarily, toggleMute, togglePlay, toggleFullscreen]);

  // Calculated Progress percentages
  const realProgressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
  const effectiveVolume = isMuted ? 0 : volume;
  const isVolumeOpen = isVolumeHovered || isDraggingVolume;

  // Fake progress bar calculation
  const isFakeProgressEnabled = Boolean(effectiveConfig.progress?.fake?.enabled);
  const fakeProgress =
    isFakeProgressEnabled && playbackMode !== "background_autoplay"
      ? calculateFakeProgress({ currentTime, duration })
      : 0;
  const fakeProgressPercent = fakeProgress * 100;
  const fakeBarHeight = Math.max(2, Math.min(10, effectiveConfig.progress?.fake?.height ?? 4));
  const fakeColorSetting = effectiveConfig.progress?.fake?.color ?? "accent";
  const fakeBarColor =
    fakeColorSetting !== "accent" && PLAYER_ACCENT_PRESETS[fakeColorSetting]
      ? PLAYER_ACCENT_PRESETS[fakeColorSetting].tokens.base
      : "var(--player-accent, #7C3AED)";

  const aspectRatio = effectiveConfig.appearance?.aspectRatio ?? "16:9";
  const aspectClass =
    aspectRatio === "9:16"
      ? "aspect-[9/16]"
      : aspectRatio === "1:1"
      ? "aspect-square"
      : "aspect-video";

  return (
    <div
      ref={containerRef}
      style={{
        ...accentStyle,
        borderRadius: isFullscreen ? 0 : `${effectiveConfig.appearance?.borderRadius ?? 12}px`,
        containerType: "inline-size",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleContainerDoubleClick}
      className={cn(
        "@container relative w-full overflow-hidden select-none group font-sans flex items-center justify-center mx-auto",
        !isEmbedded && "bg-black border border-border/40 shadow-2xl",
        !isEmbedded && aspectClass,
        isEmbedded ? "h-full" : aspectClass,
        isFullscreen && "border-none max-h-screen max-w-none aspect-auto h-full",
        className
      )}
    >
      {/* Standalone / Editor Startup Visual Surface managed by PlayerEngine */}
      {!isEmbedded && (
        <div
          ref={startupVisualRef}
          data-evandro-player-startup-visual="true"
          data-startup-url={initialVisual?.url ?? undefined}
          data-startup-type={initialVisual?.type ?? undefined}
          aria-hidden="true"
          style={{
            display: initialVisual?.url ? "flex" : "none",
            backgroundColor: "#000",
            backgroundImage: initialVisual?.url ? `url("${initialVisual.url}")` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
          className="absolute inset-0 z-5 pointer-events-none overflow-hidden flex items-center justify-center bg-black"
        />
      )}

      {/* Standalone / Editor Native Video Element managed by PlayerEngine */}
      {!isEmbedded && (
        <video
          ref={internalVideoRef}
          playsInline
          preload="auto"
          controls={false}
          onClick={togglePlay}
          className={cn(
            "w-full h-full object-contain cursor-pointer transition-opacity duration-[70ms] ease-out",
            hasFirstFrame ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Central Tap / Click-to-Toggle-Play Backdrop */}
      {playbackMode !== "background_autoplay" && !hasError && (
        <div
          aria-hidden="true"
          onClick={togglePlay}
          className="absolute inset-0 z-1 cursor-pointer"
        />
      )}

      {/* Loading Buffering Indicator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-black/20">
          <div className="flex size-14 items-center justify-center rounded-full bg-black/60 backdrop-blur-md shadow-lg">
            <Loader2 className="size-8 animate-spin" style={{ color: "var(--player-accent)" }} />
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-6 z-30 space-y-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-white text-base">
              Não foi possível reproduzir o vídeo
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Este vídeo está temporariamente indisponível.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              activateForegroundPlayback();
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Background Autoplay Active Overlay */}
      {playbackMode === "background_autoplay" && !hasError && (
        <div
          onClick={activateForegroundPlayback}
          style={{
            background: "linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.25) 50%, rgba(0, 0, 0, 0.45) 100%)",
          }}
          className="absolute inset-0 flex items-center justify-center z-15 cursor-pointer transition-colors p-3.5 @min-[400px]:p-4 group/bgoverlay"
        >
          <div className="relative flex items-center justify-center max-w-[calc(100%-24px)] @min-[400px]:max-w-[calc(100%-32px)] pointer-events-auto">
            {/* Main CTA Card */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                activateForegroundPlayback();
              }}
              className={cn(
                "relative flex flex-col items-center justify-center text-center",
                "px-5 py-3.5 @min-[400px]:px-6 @min-[400px]:py-4 rounded-2xl",
                "bg-zinc-950/85 text-white backdrop-blur-md shadow-2xl",
                "border border-white/15 select-none cursor-pointer max-w-full",
                "transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:border-white/25 hover:bg-zinc-950/90"
              )}
            >
              {/* Concentric animated sound waves */}
              <div className="relative flex items-center justify-center size-9 @min-[400px]:size-10 mb-2 shrink-0">
                <span
                  aria-hidden="true"
                  className="ep-sound-wave-1 absolute inset-0 rounded-full pointer-events-none"
                  style={{ backgroundColor: "var(--player-accent)" }}
                />
                <span
                  aria-hidden="true"
                  className="ep-sound-wave-2 absolute inset-0 rounded-full pointer-events-none"
                  style={{ backgroundColor: "var(--player-accent)" }}
                />
                <span
                  aria-hidden="true"
                  className="ep-sound-wave-3 absolute inset-0 rounded-full pointer-events-none"
                  style={{ backgroundColor: "var(--player-accent)" }}
                />

                {/* Center Audio Icon Badge */}
                <div
                  className="relative z-1 flex items-center justify-center size-9 @min-[400px]:size-10 rounded-full shadow-lg"
                  style={{
                    backgroundColor: "var(--player-accent)",
                    color: "var(--player-accent-foreground)",
                  }}
                >
                  <VolumeX className="size-4.5 @min-[400px]:size-5 fill-current shrink-0" />
                </div>
              </div>

              {/* Subtitle */}
              <span className="text-[10.5px] @min-[360px]:text-[11px] @min-[420px]:text-xs font-medium text-zinc-300 leading-tight">
                Seu vídeo já começou
              </span>

              {/* Main Action Text */}
              <span className="text-xs @min-[360px]:text-[13px] @min-[420px]:text-sm font-semibold text-white leading-snug mt-0.5 max-w-[220px] @min-[360px]:max-w-[260px] @min-[420px]:max-w-none">
                Clique para ativar o som
              </span>
            </button>
          </div>

          <style>{`
            @keyframes ep-sound-wave {
              0% {
                transform: scale(0.85);
                opacity: 0.6;
              }
              50% {
                opacity: 0.25;
              }
              100% {
                transform: scale(1.9);
                opacity: 0;
              }
            }
            .ep-sound-wave-1 {
              animation: ep-sound-wave 2.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
              animation-delay: 0s;
            }
            .ep-sound-wave-2 {
              animation: ep-sound-wave 2.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
              animation-delay: 0.7s;
            }
            .ep-sound-wave-3 {
              animation: ep-sound-wave 2.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
              animation-delay: 1.4s;
            }
            @media (prefers-reduced-motion: reduce) {
              .ep-sound-wave-1,
              .ep-sound-wave-2,
              .ep-sound-wave-3 {
                display: none !important;
                animation: none !important;
              }
            }
          `}</style>
        </div>
      )}

      {/* Big Play Button Overlay on Initial Start (Before first play) */}
      {!isPlaying && !isLoading && !hasError && playbackMode !== "background_autoplay" && !userActivatedForeground && showStartupPlayButton && isStartupReady && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-12 cursor-pointer transition-opacity bg-black/20"
        >
          <div
            style={{
              backgroundColor: "var(--player-accent)",
              color: "var(--player-accent-foreground)",
            }}
            className="flex size-14 @min-[480px]:size-16 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105 pointer-events-none"
          >
            <Play className="size-7 @min-[480px]:size-8 ml-1 fill-current" />
          </div>
        </div>
      )}

      {/* Pause Overlay (Custom Pause Thumbnail OR "Continue assistindo" Card) */}
      {!isPlaying && !isLoading && !hasError && playbackMode !== "background_autoplay" && hasStartedForeground && !isEnded && (
        <>
          {isPauseThumbActive && pauseConfig?.customUrl ? (
            <div
              onClick={togglePlay}
              className="absolute inset-0 z-12 cursor-pointer transition-opacity duration-110 ease-out flex items-center justify-center overflow-hidden bg-black/40"
            >
              <img
                src={pauseConfig.customUrl}
                alt="Thumbnail de pausa"
                onError={() => setPauseThumbError(true)}
                className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
              />
              {(pauseConfig?.showPlayButton ?? false) && (
                <div className="relative flex items-center justify-center size-14 @min-[480px]:size-16 pointer-events-none group/pauseplay">
                  {/* Concentric animated sound/pulse waves */}
                  <span
                    aria-hidden="true"
                    className="ep-pause-wave-1 absolute inset-0 rounded-full pointer-events-none"
                    style={{ backgroundColor: "var(--player-accent)" }}
                  />
                  <span
                    aria-hidden="true"
                    className="ep-pause-wave-2 absolute inset-0 rounded-full pointer-events-none"
                    style={{ backgroundColor: "var(--player-accent)" }}
                  />
                  <span
                    aria-hidden="true"
                    className="ep-pause-wave-3 absolute inset-0 rounded-full pointer-events-none"
                    style={{ backgroundColor: "var(--player-accent)" }}
                  />

                  {/* Central breathing button */}
                  <div
                    style={{
                      backgroundColor: "var(--player-accent)",
                      color: "var(--player-accent-foreground)",
                    }}
                    className="ep-pause-play-btn relative z-1 flex size-14 @min-[480px]:size-16 items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-108 pointer-events-none"
                  >
                    <Play className="size-7 @min-[480px]:size-8 ml-1 fill-current shrink-0" />
                  </div>

                  <style>{`
                    @keyframes ep-pause-wave {
                      0% {
                        transform: scale(0.9);
                        opacity: 0.55;
                      }
                      50% {
                        opacity: 0.22;
                      }
                      100% {
                        transform: scale(1.85);
                        opacity: 0;
                      }
                    }
                    @keyframes ep-pause-pulse {
                      0%, 100% {
                        transform: scale(1);
                      }
                      50% {
                        transform: scale(1.045);
                      }
                    }
                    .ep-pause-wave-1 {
                      animation: ep-pause-wave 2.4s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
                      animation-delay: 0s;
                    }
                    .ep-pause-wave-2 {
                      animation: ep-pause-wave 2.4s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
                      animation-delay: 0.8s;
                    }
                    .ep-pause-wave-3 {
                      animation: ep-pause-wave 2.4s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
                      animation-delay: 1.6s;
                    }
                    .ep-pause-play-btn {
                      animation: ep-pause-pulse 2.4s ease-in-out infinite;
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .ep-pause-wave-1,
                      .ep-pause-wave-2,
                      .ep-pause-wave-3 {
                        display: none !important;
                        animation: none !important;
                      }
                      .ep-pause-play-btn {
                        animation: none !important;
                      }
                    }
                  `}</style>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={togglePlay}
              style={{
                background: "linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.25) 50%, rgba(0, 0, 0, 0.45) 100%)",
              }}
              className="absolute inset-0 flex items-center justify-center z-12 cursor-pointer transition-colors p-3.5 @min-[400px]:p-4 group/pauseoverlay"
            >
              <div className="relative flex items-center justify-center max-w-[calc(100%-24px)] @min-[400px]:max-w-[calc(100%-32px)] pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center text-center",
                    "px-5 py-3.5 @min-[400px]:px-6 @min-[400px]:py-4 rounded-2xl",
                    "bg-zinc-950/85 text-white backdrop-blur-md shadow-2xl",
                    "border border-white/15 select-none cursor-pointer max-w-full",
                    "transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:border-white/25 hover:bg-zinc-950/90"
                  )}
                >
                  {/* Play Icon with subtle breathing halo */}
                  <div className="relative flex items-center justify-center size-9 @min-[400px]:size-10 mb-2 shrink-0">
                    <span
                      aria-hidden="true"
                      className="ep-play-halo absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        backgroundColor: "var(--player-accent)",
                      }}
                    />

                    <div
                      className="relative z-1 flex items-center justify-center size-9 @min-[400px]:size-10 rounded-full shadow-lg"
                      style={{
                        backgroundColor: "var(--player-accent)",
                        color: "var(--player-accent-foreground)",
                      }}
                    >
                      <Play className="size-4.5 @min-[400px]:size-5 ml-0.5 fill-current shrink-0" />
                    </div>
                  </div>

                  {/* Main Text */}
                  <span className="text-xs @min-[360px]:text-[13px] @min-[420px]:text-sm font-semibold text-white leading-snug">
                    Continue assistindo
                  </span>

                  {/* Microcopy */}
                  <span className="text-[10px] @min-[360px]:text-[10.5px] @min-[420px]:text-[11px] font-medium text-zinc-300 leading-tight mt-0.5">
                    Clique para continuar
                  </span>
                </button>
              </div>

              <style>{`
                @keyframes ep-play-halo {
                  0%, 100% {
                    transform: scale(0.95);
                    opacity: 0.45;
                  }
                  50% {
                    transform: scale(1.3);
                    opacity: 0;
                  }
                }
                .ep-play-halo {
                  animation: ep-play-halo 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                  .ep-play-halo {
                    display: none !important;
                    animation: none !important;
                  }
                }
              `}</style>
            </div>
          )}
        </>
      )}

      {/* Top Title Bar */}
      {title && (effectiveConfig.appearance?.showTitle ?? true) && playbackMode !== "background_autoplay" && (
        <div
          style={{
            background: "linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 60%, rgba(0, 0, 0, 0) 100%)",
          }}
          className={cn(
            "absolute top-0 inset-x-0 p-2.5 @min-[380px]:p-3 @min-[520px]:p-4 z-20 pointer-events-none transition-opacity duration-300",
            controlsVisible ? "opacity-100" : "opacity-0"
          )}
        >
          <h2 className="text-xs @min-[480px]:text-sm font-medium text-white/90 truncate drop-shadow">
            {title}
          </h2>
        </div>
      )}

      {/* Standalone Fake Progress Bar */}
      {isFakeProgressEnabled && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-15 pointer-events-none overflow-hidden select-none"
          style={{
            height: `${fakeBarHeight}px`,
            backgroundColor: "rgba(255, 255, 255, 0.2)",
          }}
        >
          <div
            className="h-full rounded-r-full"
            style={{
              width: `${fakeProgressPercent}%`,
              backgroundColor: fakeBarColor,
              transition: isPlaying ? "none" : "width 0.15s ease-out",
            }}
          />
        </div>
      )}

      {/* Bottom Adaptive Controls Overlay */}
      {!isControlsHidden && playbackMode !== "background_autoplay" && (
        <div
          data-no-fullscreen="true"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            background: "linear-gradient(0deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.6) 60%, rgba(0, 0, 0, 0) 100%)",
          }}
          className={cn(
            "absolute bottom-0 inset-x-0 p-2 @min-[380px]:p-3 @min-[520px]:p-4 z-20 transition-opacity duration-300 flex flex-col gap-1.5 @min-[380px]:gap-2.5",
            controlsVisible || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Seek Bar */}
          <div
            ref={progressTrackRef}
            onMouseDown={handleSeekMouseDown}
            className="relative group/track w-full h-3 flex items-center cursor-pointer py-1 select-none"
          >
            {/* Background track */}
            <div className="relative w-full h-1 group-hover/track:h-1.5 bg-white/25 rounded-full overflow-hidden transition-all">
              {/* Buffered progress */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full"
                style={{ width: `${bufferedPercent}%` }}
              />
              {/* Played progress */}
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full"
                style={{
                  width: `${realProgressPercent}%`,
                  backgroundColor: "var(--player-accent, #7C3AED)",
                }}
              />
            </div>

            {/* Scrubber thumb */}
            <div
              className="absolute size-3.5 rounded-full bg-white shadow-md opacity-0 group-hover/track:opacity-100 pointer-events-none border transition-opacity"
              style={{
                left: `${realProgressPercent}%`,
                transform: "translateX(-50%)",
                borderColor: "var(--player-accent, #7C3AED)",
              }}
            />
          </div>

          {/* Control Buttons & Indicators Row */}
          <div className="flex items-center justify-between gap-1 @min-[340px]:gap-1.5 @min-[400px]:gap-2 text-white flex-nowrap min-w-0">
            {/* Left: Play/Pause, Volume, Time */}
            <div className="flex items-center gap-1 @min-[340px]:gap-1.5 @min-[440px]:gap-2.5 min-w-0 shrink">
              {/* Play/Pause Button */}
              <button
                type="button"
                onClick={togglePlay}
                className="p-1 @min-[340px]:p-1.5 rounded-md hover:bg-white/15 text-white/90 hover:text-white transition-colors focus:outline-none cursor-pointer shrink-0"
                title={isPlaying ? "Pausar (Space)" : "Reproduzir (Space)"}
                aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              >
                {isPlaying ? (
                  <Pause className="size-4 @min-[380px]:size-5 fill-white/90" />
                ) : (
                  <Play className="size-4 @min-[380px]:size-5 fill-white/90" />
                )}
              </button>

              {/* Volume & Expandable Slider */}
              <div
                className="flex items-center group/volume shrink-0 relative"
                onMouseEnter={() => setIsVolumeHovered(true)}
                onMouseLeave={() => setIsVolumeHovered(false)}
              >
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1 @min-[340px]:p-1.5 rounded-md hover:bg-white/15 text-white/90 hover:text-white transition-colors focus:outline-none cursor-pointer shrink-0"
                  title={isMuted || effectiveVolume === 0 ? "Ativar som (M)" : "Silenciar (M)"}
                  aria-label={isMuted || effectiveVolume === 0 ? "Ativar som" : "Silenciar"}
                >
                  {isMuted || effectiveVolume === 0 ? (
                    <VolumeX className="size-4 @min-[380px]:size-5 text-white/80" />
                  ) : effectiveVolume < 0.5 ? (
                    <Volume1 className="size-4 @min-[380px]:size-5 text-white/90" />
                  ) : (
                    <Volume2 className="size-4 @min-[380px]:size-5 text-white/90" />
                  )}
                </button>

                <div
                  className={cn(
                    "h-6 flex items-center transition-[width,opacity,margin] duration-200 ease-out overflow-hidden",
                    isVolumeOpen
                      ? "w-11 @min-[380px]:w-14 @min-[480px]:w-16 opacity-100 ml-1 mr-1 pointer-events-auto"
                      : "w-0 opacity-0 m-0 pointer-events-none"
                  )}
                >
                  <div
                    ref={volumeTrackRef}
                    onMouseDown={handleVolumeMouseDown}
                    className="relative w-full h-3 flex items-center cursor-pointer select-none group/voltrack"
                    role="slider"
                    aria-label="Volume"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(effectiveVolume * 100)}
                  >
                    {/* Background Track */}
                    <div className="relative w-full h-1 bg-white/25 rounded-full overflow-hidden">
                      {/* Filled Track */}
                      <div
                        className="absolute left-0 top-0 bottom-0 rounded-full"
                        style={{
                          width: `${effectiveVolume * 100}%`,
                          backgroundColor: "var(--player-accent, #7C3AED)",
                        }}
                      />
                    </div>

                    {/* Volume Thumb */}
                    <div
                      className="absolute size-2.5 @min-[380px]:size-3 rounded-full bg-white shadow-sm pointer-events-none border transition-transform"
                      style={{
                        left: `${effectiveVolume * 100}%`,
                        transform: "translateX(-50%)",
                        borderColor: "var(--player-accent, #7C3AED)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Time Display */}
              <div className="text-[10px] @min-[340px]:text-[11px] @min-[440px]:text-xs font-mono text-zinc-300 tabular-nums whitespace-nowrap shrink-0">
                <span>{formatTime(currentTime)}</span>
                <span className="text-zinc-500 mx-0.5 @min-[340px]:mx-1">/</span>
                <span className="hidden @min-[290px]:inline">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right: Playback Speed & Fullscreen */}
            <div className="flex items-center gap-0.5 @min-[340px]:gap-1 @min-[380px]:gap-1.5 shrink-0">
              {/* Settings / Speed Popup */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    "p-1 @min-[340px]:p-1.5 rounded-md hover:bg-white/15 transition-colors focus:outline-none cursor-pointer",
                    showSettings ? "bg-white/20 text-white" : "text-white/80 hover:text-white"
                  )}
                  title="Velocidade de reprodução"
                  aria-label="Velocidade de reprodução"
                >
                  <Gauge className="size-4 @min-[380px]:size-5" />
                </button>

                {showSettings && (
                  <div className="absolute right-0 bottom-full mb-2 bg-zinc-900/95 border border-white/15 backdrop-blur-md rounded-lg shadow-xl py-1.5 px-1 min-w-[120px] z-30 font-sans">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2.5 py-1">
                      Velocidade
                    </div>
                    {PLAYBACK_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleRateChange(rate)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1 text-xs rounded-md text-left transition-colors cursor-pointer",
                          playbackRate === rate
                            ? "bg-white/15 text-white font-medium"
                            : "text-zinc-300 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                        {playbackRate === rate && <Check className="size-3 text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen Button */}
              {fullscreenConfig.enabled && fullscreenConfig.button && (
                <button
                  type="button"
                  onClick={() => toggleFullscreen("button")}
                  className="p-1 @min-[340px]:p-1.5 rounded-md hover:bg-white/15 text-white/80 hover:text-white transition-colors focus:outline-none cursor-pointer"
                  title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
                  aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                >
                  {isFullscreen ? (
                    <Minimize className="size-4 @min-[380px]:size-5" />
                  ) : (
                    <Maximize className="size-4 @min-[380px]:size-5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
