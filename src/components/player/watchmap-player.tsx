/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
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
import { PlaybackController } from "./controllers/playback-controller";
import {
  type PlayerConfig,
  DEFAULT_PLAYER_CONFIG,
  PLAYER_ACCENT_PRESETS,
} from "@/types/player-config";
import { calculateFakeProgress } from "@/lib/player/fake-progress-engine";
import Hls from "hls.js";

interface WatchMapPlayerProps {
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

export function WatchMapPlayer({
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
  onEvent,
  onRuntimeReady,
}: WatchMapPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<PlayerRuntime | null>(null);
  const playbackControllerRef = useRef<PlaybackController | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hasResolvedInitialPlaybackRef = useRef(false);

  const [activatedSrc, setActivatedSrc] = useState<string | null>(null);
  const resolvedSrc = activatedSrc || src || "";
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Play session ID for server-side activation and quota tracking (idempotent per instance)
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

  // Extract Mux Playback ID from resolvedSrc if present
  const muxPlaybackId = React.useMemo(() => {
    const media = resolvedSrc || src;
    if (!media) return null;
    const match = media.match(/stream\.mux\.com\/([a-zA-Z0-9_-]+)\.m3u8/);
    return match ? match[1] : null;
  }, [resolvedSrc, src]);

  // Derive highest-quality available preview (R2 WebP > Mux Animated WebP > R2/Custom Poster > Mux Thumbnail)
  const displayPreviewSrc =
    backgroundPreviewUrl ||
    (muxPlaybackId ? `https://image.mux.com/${muxPlaybackId}/animated.webp?start=0&end=10&width=640&fps=12` : null) ||
    posterUrl ||
    (muxPlaybackId ? `https://image.mux.com/${muxPlaybackId}/thumbnail.webp?width=640` : null);

  // User explicit foreground activation state
  const [prevSrc, setPrevSrc] = useState(src);
  const playbackKey = `${effectiveConfig.playback?.backgroundAutoplay ? 1 : 0}`;
  const [prevPlaybackKey, setPrevPlaybackKey] = useState(playbackKey);
  const [userActivatedForeground, setUserActivatedForeground] = useState(false);
  const pendingForegroundActivationRef = useRef(false);
  const [hasStartedPlayingForeground, setHasStartedPlayingForeground] = useState(false);
  const [isTransitioningPreviewOut, setIsTransitioningPreviewOut] = useState(false);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setUserActivatedForeground(false);
    setHasStartedPlayingForeground(false);
  }

  if (playbackKey !== prevPlaybackKey) {
    setPrevPlaybackKey(playbackKey);
    setUserActivatedForeground(false);
    setHasStartedPlayingForeground(false);
  }

  // Dynamic mode resolution based on config and user interaction
  const isBackgroundAutoplay = Boolean(
    effectiveConfig.playback?.backgroundAutoplay && !userActivatedForeground
  );

  const playbackMode: PlaybackMode = isBackgroundAutoplay ? "background_autoplay" : "foreground";

  // Immediate media attachment: Video is ALWAYS attached and buffered immediately upon access
  const isMediaAttached = Boolean(resolvedSrc);

  // Derived Lightweight Background Preview ONLY renders when Background Autoplay is active for this video
  const isPreviewVisible = Boolean(
    isBackgroundAutoplay && displayPreviewSrc && !hasStartedPlayingForeground
  );

  const initialVolume = effectiveConfig.playback?.defaultVolume ?? 1;
  const initialPlaybackRate = effectiveConfig.playback?.defaultPlaybackRate ?? 1;

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [isMuted, setIsMuted] = useState(initialVolume === 0);
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const lastVolumeRef = useRef(initialVolume);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const defaultPlaybackRate = effectiveConfig.playback?.defaultPlaybackRate ?? 1;
  const defaultVolume = effectiveConfig.playback?.defaultVolume ?? 1;

  // Reset initial playback resolution on src or playback config change
  useEffect(() => {
    hasResolvedInitialPlaybackRef.current = false;
    pendingForegroundActivationRef.current = false;
  }, [src, playbackKey]);

  // Apply default media settings (volume and rate) on fresh playback init
  const applyInitialMediaSettings = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = defaultPlaybackRate;
    setPlaybackRate(defaultPlaybackRate);

    if (playbackMode !== "background_autoplay") {
      video.volume = defaultVolume;
      video.muted = defaultVolume === 0;
      setVolume(defaultVolume);
      setIsMuted(defaultVolume === 0);
      lastVolumeRef.current = defaultVolume;
    }
  }, [defaultPlaybackRate, defaultVolume, playbackMode]);

  // Helper to trigger initial playback resolution safely once
  const triggerInitialPlaybackIfNeeded = useCallback(() => {
    if (!playbackControllerRef.current || !videoRef.current) return;

    if (pendingForegroundActivationRef.current) {
      pendingForegroundActivationRef.current = false;
      hasResolvedInitialPlaybackRef.current = true;
      playbackControllerRef.current.startForegroundPlayback(lastVolumeRef.current);
      return;
    }

    if (!hasResolvedInitialPlaybackRef.current) {
      hasResolvedInitialPlaybackRef.current = true;
      playbackControllerRef.current.resolveInitialPlayback();
    }
  }, []);

  // Update controller config when effectiveConfig changes
  useEffect(() => {
    playbackControllerRef.current?.updateConfig(effectiveConfig);
  }, [effectiveConfig]);

  // Media source attachment (Prioritize HLS.js for all MSE browsers, fallback to native Safari)
  const attachMediaSource = useCallback((mediaSrc: string) => {
    const video = videoRef.current;
    if (!video || !mediaSrc) return;

    setHasError(false);
    setIsLoading(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = mediaSrc.includes(".m3u8") || mediaSrc.includes("stream.mux.com");

    if (isHls && Hls.isSupported()) {
      // 1. MSE-capable browsers (Chrome, Edge, Firefox, etc.)
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.loadSource(mediaSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        setHasError(false);
        applyInitialMediaSettings();
        triggerInitialPlaybackIfNeeded();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error("[WatchMap Player HLS Fatal Error]", data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("[WatchMap Player HLS] Retrying network error...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("[WatchMap Player HLS] Recovering media error...");
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setHasError(true);
              setIsLoading(false);
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      // 2. Native HLS only when MSE is not available (Safari / iOS WebKit)
      video.src = mediaSrc;
    } else {
      video.src = mediaSrc;
    }
  }, [applyInitialMediaSettings, triggerInitialPlaybackIfNeeded]);

  // Attach media source conditionally (Only if foreground is active or autoplay requested)
  useEffect(() => {
    if (isMediaAttached && resolvedSrc) {
      attachMediaSource(resolvedSrc);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [resolvedSrc, isMediaAttached, attachMediaSource]);

  // Initialize PlayerRuntime and PlaybackController lifecycle
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video) return;

    const runtime = new PlayerRuntime(video, {
      videoId,
      debug: effectiveDebug,
      containerElement: container,
    });

    const controller = new PlaybackController({
      video,
      runtime,
      config: effectiveConfig,
    });

    runtimeRef.current = runtime;
    playbackControllerRef.current = controller;

    let unsubscribe: (() => void) | undefined;
    if (onEvent) {
      unsubscribe = runtime.subscribe(onEvent);
    }

    onRuntimeReady?.(runtime);

    // If media is attached and metadata is already available
    if (isMediaAttached) {
      if (video.readyState >= 1) {
        if (video.duration && Number.isFinite(video.duration)) {
          setDuration(video.duration);
        }
        setIsLoading(false);
      }
      triggerInitialPlaybackIfNeeded();
    }

    return () => {
      runtimeRef.current = null;
      playbackControllerRef.current?.dispose();
      playbackControllerRef.current = null;
      unsubscribe?.();
      runtime.destroy();
    };
  }, [videoId, effectiveDebug, onEvent, onRuntimeReady, isMediaAttached, effectiveConfig, triggerInitialPlaybackIfNeeded]);

  // 60fps smooth linear progress animation loop
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      const video = videoRef.current;
      if (video && !isDraggingSeek) {
        setCurrentTime(video.currentTime);
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
  }, [isPlaying, isDraggingSeek]);

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

  const hasRecordedPlayRef = useRef(false);

  const recordPlayActivation = useCallback(async () => {
    if (hasRecordedPlayRef.current) return;
    hasRecordedPlayRef.current = true;

    try {
      const base = (apiBase || "").replace(/\/$/, "");
      const activateEndpoint = `${base}/api/embed/videos/${encodeURIComponent(videoId)}/activate`;
      await fetch(activateEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          playSessionId: getPlaySessionId(),
          isEditor: Boolean(isEditor),
        }),
      });
    } catch (err) {
      console.warn("[WatchMap Player] Play activation report error:", err);
    }
  }, [apiBase, videoId, getPlaySessionId, isEditor]);

  // Main foreground playback activation (seamless preview -> HLS transition with server authorization)
  const activateForegroundPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setUserActivatedForeground(true);
    recordPlayActivation();

    const targetVol = lastVolumeRef.current > 0 ? lastVolumeRef.current : defaultVolume;
    const targetRate = defaultPlaybackRate;

    video.volume = targetVol;
    video.muted = targetVol === 0;
    video.playbackRate = targetRate;
    setVolume(targetVol);
    setIsMuted(targetVol === 0);
    setPlaybackRate(targetRate);

    let activeMediaUrl = resolvedSrc;

    // If no HLS url resolved yet, request server activation with playSessionId
    if (!activeMediaUrl) {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage(null);

      try {
        const base = (apiBase || "").replace(/\/$/, "");
        const activateEndpoint = `${base}/api/embed/videos/${encodeURIComponent(videoId)}/activate`;
        const response = await fetch(activateEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            playSessionId: getPlaySessionId(),
            isEditor: Boolean(isEditor),
          }),
        });

        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(errorJson.error || "Este vídeo está temporariamente indisponível.");
        }

        const resData = await response.json();
        const playbackUrl = resData.playback?.url || resData.playbackUrl;
        if (!playbackUrl) {
          throw new Error("Este vídeo está temporariamente indisponível.");
        }

        activeMediaUrl = playbackUrl;
        setActivatedSrc(playbackUrl);
      } catch (err: unknown) {
        console.error("[WatchMap Player] Playback activation failed:", err);
        setIsLoading(false);
        setHasError(true);
        const msg =
          err instanceof Error ? err.message : "Este vídeo está temporariamente indisponível.";
        setErrorMessage(msg);
        return;
      }
    }

    // Attach HLS media source if not yet attached
    if (!hlsRef.current && (!video.src || video.src === "")) {
      pendingForegroundActivationRef.current = true;
      attachMediaSource(activeMediaUrl);
    } else {
      pendingForegroundActivationRef.current = false;
      if (playbackControllerRef.current) {
        await playbackControllerRef.current.startForegroundPlayback(targetVol);
      } else {
        video.loop = false;
        if (video.currentTime !== 0) {
          try {
            video.currentTime = 0;
          } catch {
            // ignore
          }
        }
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          if (video.paused) {
            video.play().catch(() => {});
          }
        };
        video.addEventListener("seeked", onSeeked, { once: true });
        video.play().catch(() => {});
      }
    }
  }, [
    attachMediaSource,
    defaultPlaybackRate,
    defaultVolume,
    resolvedSrc,
    apiBase,
    videoId,
    isEditor,
    getPlaySessionId,
    recordPlayActivation,
  ]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (playbackMode === "background_autoplay" || !userActivatedForeground) {
      activateForegroundPlayback();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    recordPlayActivation();

    // If currently playing muted due to browser autoplay fallback, clicking anywhere on the player immediately unmutes with audio
    if (isPlaying && (video.muted || isMuted)) {
      const restored = lastVolumeRef.current > 0 ? lastVolumeRef.current : defaultVolume;
      video.muted = false;
      video.volume = restored;
      setVolume(restored);
      setIsMuted(false);
      return;
    }

    if (!isMediaAttached) {
      activateForegroundPlayback();
      return;
    }

    if (playbackControllerRef.current) {
      playbackControllerRef.current.handleUserPlayToggle(lastVolumeRef.current);
      return;
    }

    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [
    playbackMode,
    userActivatedForeground,
    isMediaAttached,
    isPlaying,
    isMuted,
    defaultVolume,
    activateForegroundPlayback,
    recordPlayActivation,
  ]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    if (playbackMode === "background_autoplay") {
      activateForegroundPlayback();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0 || isMuted) {
      const restored = lastVolumeRef.current > 0 ? lastVolumeRef.current : 1;
      video.muted = false;
      video.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      lastVolumeRef.current = video.volume > 0 ? video.volume : 1;
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, playbackMode, activateForegroundPlayback]);

  // Volume drag/click
  const updateVolumeFromPosition = useCallback((clientX: number) => {
    const track = volumeTrackRef.current;
    const video = videoRef.current;
    if (!track || !video) return;

    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    const rawVol = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newVol = Math.round(rawVol * 100) / 100;

    video.volume = newVol;
    video.muted = newVol === 0;
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (newVol > 0) {
      lastVolumeRef.current = newVol;
    }
  }, []);

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

  // Playback rate change
  const handleRateChange = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  // Seek calculation from mouse event
  const seekToPosition = (clientX: number) => {
    const track = progressTrackRef.current;
    const video = videoRef.current;
    if (!track || !video || !duration) return;

    const rect = track.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;

    video.currentTime = targetTime;
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

  // Fullscreen toggle (shared controller for button and double click)
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

  // Double click handler on video container / main area
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

  // Listen to fullscreen changes for UI state
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
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        }
        showControlsTemporarily();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(
            duration,
            videoRef.current.currentTime + 5
          );
        }
        showControlsTemporarily();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [duration, showControlsTemporarily, toggleMute, togglePlay, toggleFullscreen]);

  // Video event handlers
  const handleDurationChange = () => {
    if (videoRef.current && videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      if (!isDraggingSeek) {
        setCurrentTime(videoRef.current.currentTime);
      }
      if (videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
        setDuration((prev) => (prev === 0 ? videoRef.current!.duration : prev));
      }
      if (videoRef.current.buffered.length > 0) {
        try {
          const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
          setBufferedEnd(end);
        } catch {
          // ignore index errors
        }
      }
    }
  };

  const handleVolumeSync = () => {
    if (videoRef.current) {
      setVolume(videoRef.current.volume);
      setIsMuted(videoRef.current.muted || videoRef.current.volume === 0);
      if (videoRef.current.volume > 0 && !videoRef.current.muted) {
        lastVolumeRef.current = videoRef.current.volume;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      if (videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
      setIsLoading(false);
      applyInitialMediaSettings();
      triggerInitialPlaybackIfNeeded();
    }
  };

  const handleCanPlay = () => {
    if (videoRef.current && videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
      setDuration((prev) => (prev === 0 ? videoRef.current!.duration : prev));
    }
    setIsLoading(false);
    triggerInitialPlaybackIfNeeded();
  };

  const handleWaiting = () => {
    setIsLoading(true);
  };

  const handlePlaying = () => {
    setIsLoading(false);
    setIsPlaying(true);
    setHasStartedPlayingForeground(true);

    // Fade out preview layer seamlessly once real video frames are rendering
    if (displayPreviewSrc) {
      setIsTransitioningPreviewOut(true);
      setTimeout(() => {
        setIsTransitioningPreviewOut(false);
      }, 200);
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setControlsVisible(true);
  };

  const handleError = () => {
    const video = videoRef.current;
    // When HLS.js is active, error handling is delegated to Hls.Events.ERROR
    if (hlsRef.current) {
      return;
    }
    // Only trigger error overlay if video has an actual native error code and valid src
    if (video?.error && src) {
      console.error("[WatchMap Player Native Video Error]", video.error);
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleLoadStart = () => {
    if (src && isMediaAttached) {
      setIsLoading(true);
      setHasError(false);
    }
  };

  // Real progress for native timeline (always currentTime / duration)
  const realProgressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
  const effectiveVolume = isMuted ? 0 : volume;
  const isVolumeOpen = isVolumeHovered || isDraggingVolume;

  // Fake Progress Bar (isolated layer, 0% during background autoplay)
  const isFakeProgressEnabled = Boolean(effectiveConfig.progress?.fake?.enabled);
  const fakeProgress =
    isFakeProgressEnabled && playbackMode !== "background_autoplay"
      ? calculateFakeProgress({ currentTime, duration })
      : 0;
  const fakeProgressPercent = fakeProgress * 100;
  const fakeBarHeight = Math.max(2, Math.min(10, effectiveConfig.progress?.fake?.height ?? 4));

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
        containerType: "inline-size",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleContainerDoubleClick}
      className={cn(
        "@container relative w-full rounded-xl overflow-hidden bg-black select-none group font-sans flex items-center justify-center border border-border/40 shadow-2xl mx-auto",
        aspectClass,
        isFullscreen && "rounded-none border-none max-h-screen max-w-none aspect-auto h-full",
        className
      )}
    >
      {/* Derived Lightweight Background Preview / Poster Layer (R2 / Mux Animated WebP / GIF / Poster) */}
      {isPreviewVisible && displayPreviewSrc && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 z-5 pointer-events-none overflow-hidden transition-opacity duration-200 ease-out",
            isTransitioningPreviewOut ? "opacity-0" : "opacity-100"
          )}
        >
          <img
            src={displayPreviewSrc}
            alt=""
            className="w-full h-full object-contain pointer-events-none select-none"
          />
        </div>
      )}

      {/* Native Video Element (Real Mux HLS Playback) */}
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        autoPlay={isBackgroundAutoplay}
        muted={isBackgroundAutoplay}
        controls={false}
        onClick={togglePlay}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onDurationChange={handleDurationChange}
        onTimeUpdate={handleTimeUpdate}
        onVolumeChange={handleVolumeSync}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        className="w-full h-full object-contain cursor-pointer"
      />

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
              {errorMessage || "Este vídeo está temporariamente indisponível."}
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
            {/* Subtle External Pulse Ring (Expands & Fades Out - Derived luminous accent) */}
            <div
              aria-hidden="true"
              className="wm-pulse-ring pointer-events-none absolute -inset-1 rounded-2xl"
              style={{
                boxShadow: "0 0 0 3px color-mix(in srgb, var(--player-accent) 25%, white 75%)",
                animation: "wm-pulse-ring 2s cubic-bezier(0.2, 0, 0.4, 1) infinite",
              }}
            />

            {/* Main CTA Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                activateForegroundPlayback();
              }}
              style={{ backgroundColor: "var(--player-accent)" }}
              className={cn(
                "relative flex flex-col items-center justify-center text-center",
                "px-5 py-3.5 @min-[400px]:px-6 @min-[400px]:py-4 rounded-2xl text-white",
                "shadow-2xl backdrop-blur-md transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]",
                "border border-white/20 select-none cursor-pointer max-w-full"
              )}
            >
              {/* Icon */}
              <div className="flex items-center justify-center size-7 @min-[400px]:size-8 rounded-full bg-white/15 mb-1.5 shrink-0">
                <Volume2 className="size-4 @min-[400px]:size-4.5 fill-white text-white shrink-0" />
              </div>

              {/* Subtitle / Context */}
              <span className="text-[10px] @min-[360px]:text-[11px] @min-[420px]:text-xs font-medium text-white/80 leading-tight">
                Seu vídeo já começou
              </span>

              {/* Main Action Text */}
              <span className="text-xs @min-[360px]:text-[13px] @min-[420px]:text-sm font-semibold text-white leading-snug mt-0.5 max-w-[220px] @min-[360px]:max-w-[260px] @min-[420px]:max-w-none">
                Clique para ativar o som
              </span>
            </button>
          </div>

          <style>{`
            @keyframes wm-pulse-ring {
              0% {
                transform: scale(0.96);
                opacity: 0.85;
              }
              65%, 100% {
                transform: scale(1.08, 1.15);
                opacity: 0;
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .wm-pulse-ring {
                display: none !important;
                animation: none !important;
              }
            }
          `}</style>
        </div>
      )}

      {/* Big Play Button Overlay on Pause */}
      {!isPlaying && !isLoading && !hasError && playbackMode !== "background_autoplay" && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer bg-black/20 transition-opacity"
        >
          <div
            style={{ backgroundColor: "var(--player-accent)" }}
            className="flex size-14 @min-[480px]:size-16 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105"
          >
            <Play className="size-7 @min-[480px]:size-8 ml-1 fill-white" />
          </div>
        </div>
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

      {/* Standalone Fake Progress Bar (Independent layer on bottom of video) */}
      {isFakeProgressEnabled && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-10 pointer-events-none overflow-hidden select-none"
          style={{
            height: `${fakeBarHeight}px`,
            backgroundColor: "rgba(255, 255, 255, 0.2)",
          }}
        >
          <div
            className="h-full rounded-r-full"
            style={{
              width: `${fakeProgressPercent}%`,
              backgroundColor: "var(--player-accent, #7C3AED)",
              transition: isPlaying ? "none" : "width 0.15s ease-out",
            }}
          />
        </div>
      )}

      {/* Bottom Adaptive Controls Overlay */}
      {!isControlsHidden && playbackMode !== "background_autoplay" && (
        <div
          data-no-fullscreen="true"
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            background: "linear-gradient(0deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.6) 60%, rgba(0, 0, 0, 0) 100%)",
          }}
          className={cn(
            "absolute bottom-0 inset-x-0 p-2 @min-[380px]:p-3 @min-[520px]:p-4 z-20 transition-opacity duration-300 flex flex-col gap-1.5 @min-[380px]:gap-2.5",
            controlsVisible || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Seek Bar (Linear, Smooth, Spans 100% width) */}
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

          {/* Control Buttons & Indicators Row (Responsive Flex Nowrap) */}
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

              {/* Volume & YouTube-style Expandable Slider */}
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
