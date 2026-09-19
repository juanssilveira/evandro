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
import type Hls from "hls.js";
import { shouldUseNativeHls, loadHlsEngine } from "./embed/hls-engine";
import {
  createStartupHlsConfig,
  saveBandwidthEstimate,
  getInitialBandwidthEstimate,
} from "./embed/startup-abr";
import { MediaLoadingStateManager } from "./embed/media-loading-state";
import {
  markPerformance,
  markPerformanceOnce,
  measurePerformance,
  onFirstVideoFrame,
  logPerformanceDebugReport,
} from "./embed/performance-timing";

import type { PlayerEngine } from "./engine/player-engine";

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
  engine,
  onEvent,
  onRuntimeReady,
}: EvandroPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(mediaElement || null);

  // Synchronize external mediaElement when provided (embed mode)
  useEffect(() => {
    if (mediaElement) {
      videoRef.current = mediaElement;
    }
  }, [mediaElement]);

  // Canonical ref callback for internal video element (editor / standalone mode)
  const handleInternalVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      internalVideoRef.current = el;
      if (!mediaElement) {
        videoRef.current = el;
      }
    },
    [mediaElement]
  );

  const progressTrackRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<PlayerRuntime | null>(null);
  const playbackControllerRef = useRef<PlaybackController | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hasResolvedInitialPlaybackRef = useRef(false);
  const userPlayClickTimestampRef = useRef<number | null>(null);

  const resolvedSrc = src || "";

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

  // User explicit foreground activation & First Frame boundary state
  const [prevSrc, setPrevSrc] = useState(src);
  const playbackKey = `${effectiveConfig.playback?.backgroundAutoplay ? 1 : 0}`;
  const [prevPlaybackKey, setPrevPlaybackKey] = useState(playbackKey);
  const [userActivatedForeground, setUserActivatedForeground] = useState(false);
  const pendingForegroundActivationRef = useRef(false);
  const [isPlayPending, setIsPlayPending] = useState(false);
  const [hasStartedPlayingForeground, setHasStartedPlayingForeground] = useState(false);
  const [hasFirstFrameRendered, setHasFirstFrameRendered] = useState(false);
  const [hasRevealedVideo, setHasRevealedVideo] = useState(false);
  const [isTransitioningPreviewOut, setIsTransitioningPreviewOut] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [customThumbError, setCustomThumbError] = useState(false);
  const [pauseThumbError, setPauseThumbError] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setUserActivatedForeground(false);
    setIsPlayPending(false);
    setHasStartedPlayingForeground(false);
    setHasFirstFrameRendered(false);
    setHasRevealedVideo(false);
    setPreviewError(false);
    setCustomThumbError(false);
    setPauseThumbError(false);
    setIsEnded(false);
  }

  if (playbackKey !== prevPlaybackKey) {
    setPrevPlaybackKey(playbackKey);
    setUserActivatedForeground(false);
    setIsPlayPending(false);
    setHasStartedPlayingForeground(false);
    setHasFirstFrameRendered(false);
    setHasRevealedVideo(false);
    setPreviewError(false);
    setCustomThumbError(false);
    setPauseThumbError(false);
    setIsEnded(false);
  }

  useEffect(() => {
    mediaStateManager.reset();
  }, [src, mediaStateManager]);

  // Dynamic mode resolution based on config and user interaction
  const isBackgroundAutoplay = Boolean(
    effectiveConfig.playback?.backgroundAutoplay && !userActivatedForeground
  );

  // Strict Startup Visual Policy (for editor / standalone fallback)
  const thumbConfig = effectiveConfig.appearance?.thumbnail;
  const isThumbEnabled = thumbConfig?.enabled ?? true;
  const isCustomStartup = thumbConfig?.source === "custom" && Boolean(thumbConfig?.customUrl);
  const customStartupUrl = thumbConfig?.customUrl;
  const candidateBgPreview = previewError ? null : (backgroundPreviewUrl || null);

  let displayPreviewSrc: string | null = null;
  if (isBackgroundAutoplay) {
    displayPreviewSrc = candidateBgPreview;
  } else if (isThumbEnabled) {
    if (isCustomStartup && customStartupUrl && !customThumbError) {
      displayPreviewSrc = customStartupUrl;
    } else {
      displayPreviewSrc = posterUrl || null;
    }
  }

  const playbackMode: PlaybackMode = isBackgroundAutoplay ? "background_autoplay" : "foreground";

  // Immediate media attachment: Video is ALWAYS attached and prebuffered immediately
  const isMediaAttached = Boolean(resolvedSrc);

  // Derived Preview / Poster Layer:
  // In BG ON: visible until first video frame renders
  // In BG OFF + Thumb ON: remains visible until user Play AND first video frame renders (no black flash, no premature removal)
  // In BG OFF + Thumb OFF: never visible
  const isPreviewVisible = Boolean(
    !mediaElement &&
      displayPreviewSrc &&
      (isBackgroundAutoplay
        ? !hasFirstFrameRendered
        : !userActivatedForeground || !hasFirstFrameRendered)
  );

  // Pause Thumbnail Active state
  const pauseConfig = effectiveConfig.appearance?.pauseThumbnail;
  const isPauseThumbActive = Boolean(
    pauseConfig?.enabled && pauseConfig?.customUrl && !pauseThumbError
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

  const configRef = useRef(effectiveConfig);
  const modeRef = useRef(playbackMode);
  const attachedSrcRef = useRef<string | null>(null);

  useEffect(() => {
    configRef.current = effectiveConfig;
    modeRef.current = playbackMode;
  }, [effectiveConfig, playbackMode]);

  // Reset initial playback resolution on src change
  useEffect(() => {
    hasResolvedInitialPlaybackRef.current = false;
    pendingForegroundActivationRef.current = false;
  }, [src]);

  // React immediately to dynamic changes in backgroundAutoplay (e.g. live toggle in editor)
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const controller = playbackControllerRef.current;
    const video = videoRef.current;
    if (!controller || !video) return;

    if (effectiveConfig.playback?.backgroundAutoplay) {
      controller.startBackgroundAutoplay().catch(() => {});
    } else {
      controller.stopBackgroundAutoplay();
    }
  }, [playbackKey, effectiveConfig.playback?.backgroundAutoplay]);

  // Apply default media settings (volume and rate) on fresh playback init
  const applyInitialMediaSettings = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const currentConfig = configRef.current;
    const currentRate = currentConfig.playback?.defaultPlaybackRate ?? 1;
    const currentVol = currentConfig.playback?.defaultVolume ?? 1;

    video.playbackRate = currentRate;
    setPlaybackRate(currentRate);

    if (modeRef.current !== "background_autoplay") {
      video.volume = currentVol;
      video.muted = currentVol === 0;
      setVolume(currentVol);
      setIsMuted(currentVol === 0);
      lastVolumeRef.current = currentVol;
    }
  }, []);

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

  // Update controller config when effectiveConfig changes without destroying controller
  useEffect(() => {
    playbackControllerRef.current?.updateConfig(effectiveConfig);
  }, [effectiveConfig]);

  // Prefetch Pause Thumbnail after foreground playback starts
  useEffect(() => {
    if (
      hasStartedPlayingForeground &&
      effectiveConfig.appearance?.pauseThumbnail?.enabled &&
      effectiveConfig.appearance?.pauseThumbnail?.customUrl
    ) {
      const img = new Image();
      img.src = effectiveConfig.appearance.pauseThumbnail.customUrl;
    }
  }, [
    hasStartedPlayingForeground,
    effectiveConfig.appearance?.pauseThumbnail?.enabled,
    effectiveConfig.appearance?.pauseThumbnail?.customUrl,
  ]);

  // First frame detection & click-to-frame performance tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const cleanup = onFirstVideoFrame(video, (frameTime) => {
      markPerformance("ep:first-frame", videoId);
      markPerformance("ep:visual:main-reveal", videoId);
      mediaStateManager.onFirstFrame();

      setHasFirstFrameRendered(true);

      if (isBackgroundAutoplay) {
        // In BG ON: smoothly crossfade preview out and video in (140ms)
        setHasRevealedVideo(true);
        if (displayPreviewSrc) {
          setIsTransitioningPreviewOut(true);
          setTimeout(() => {
            setIsTransitioningPreviewOut(false);
          }, 140);
        }
      } else if (!isThumbEnabled) {
        // In BG OFF + Thumb OFF: video reveals directly on first frame (140ms fade-in)
        setHasRevealedVideo(true);
      } else if (hasStartedPlayingForeground) {
        // User already played before first frame arrived: reveal video and transition thumbnail out
        setHasRevealedVideo(true);
        if (displayPreviewSrc) {
          setIsTransitioningPreviewOut(true);
          setTimeout(() => {
            setIsTransitioningPreviewOut(false);
          }, 140);
        }
      }
      // In BG OFF + Thumb ON: thumbnail stays visible and video stays hidden until user Play

      let clickToFrame: number | undefined;
      if (userPlayClickTimestampRef.current != null) {
        markPerformance("ep:user-play-first-frame", videoId);
        clickToFrame = Math.round(frameTime - userPlayClickTimestampRef.current);
        userPlayClickTimestampRef.current = null;
      }

      if (effectiveDebug) {
        const bootstrapDur = measurePerformance("ep:bootstrap", "ep:bootstrap:start", "ep:bootstrap:end", videoId);
        const coreReadyDur = measurePerformance("ep:core:ready", "ep:core:start", "ep:core:ready", videoId);
        const hlsReadyDur = measurePerformance("ep:hls-engine", "ep:hls-engine:start", "ep:hls-engine:ready");
        const manifestDur = measurePerformance("ep:manifest", "ep:manifest:start", "ep:manifest:parsed", videoId);
        const firstFragDur =
          measurePerformance("ep:first-frag", "ep:first-frag:start", "ep:first-frag:buffered", videoId) ??
          measurePerformance("ep:first-frag", "ep:first-frag:start", "ep:first-frag:loaded", videoId);
        const canPlayDur = measurePerformance("ep:canplay", "ep:media:attach", "ep:canplay", videoId);
        const firstFrameDur = measurePerformance("ep:first-frame", "ep:media:attach", "ep:first-frame", videoId);

        const bwEstimate = hlsRef.current?.bandwidthEstimate
          ? `${(hlsRef.current.bandwidthEstimate / 1_000_000).toFixed(2)} Mbps`
          : undefined;
        const currentLevelIndex = hlsRef.current?.currentLevel ?? hlsRef.current?.firstLevel;
        const currentLevel =
          currentLevelIndex != null && hlsRef.current?.levels
            ? hlsRef.current.levels[currentLevelIndex]
            : undefined;
        const startupLevel = currentLevel?.height ? `${currentLevel.height}p` : undefined;
        const startupBitrate = currentLevel?.bitrate ? `${Math.round(currentLevel.bitrate / 1000)} kbps` : undefined;

        logPerformanceDebugReport(videoId, {
          videoId,
          bootstrapDurationMs: bootstrapDur ?? undefined,
          coreReadyDurationMs: coreReadyDur ?? undefined,
          hlsEngineReadyDurationMs: hlsReadyDur ?? undefined,
          manifestDurationMs: manifestDur ?? undefined,
          firstFragDurationMs: firstFragDur ?? undefined,
          canPlayDurationMs: canPlayDur ?? undefined,
          firstFrameDurationMs: firstFrameDur ?? undefined,
          clickToFrameDurationMs: clickToFrame,
          startupLevel,
          startupBitrate,
          bandwidthEstimate: bwEstimate,
        });
      }
    });

    return cleanup;
  }, [
    videoId,
    effectiveDebug,
    displayPreviewSrc,
    mediaStateManager,
    isBackgroundAutoplay,
    isThumbEnabled,
    hasStartedPlayingForeground,
  ]);

  // Media source attachment (Native Safari HLS bypass + Dynamic HLS Light for MSE)
  const attachMediaSource = useCallback(async (mediaSrc: string) => {
    if (engine || mediaElement) return;
    const video = videoRef.current;
    if (!video || !mediaSrc) return;

    if (attachedSrcRef.current === mediaSrc && (hlsRef.current || video.src)) {
      return;
    }

    attachedSrcRef.current = mediaSrc;
    setHasError(false);
    mediaStateManager.onMediaAttach();
    markPerformance("ep:media:attach", videoId);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = mediaSrc.includes(".m3u8") || mediaSrc.includes("m3u8");

    // 1. Native HLS for Safari macOS / iOS WebKit (0 bytes HLS.js transferred)
    if (isHls && shouldUseNativeHls(video)) {
      markPerformance("ep:manifest:start", videoId);
      video.src = mediaSrc;
      return;
    }

    // 2. Dynamic HLS Light for MSE browsers (Chrome, Edge, Firefox, etc.)
    if (isHls) {
      try {
        const HlsClass = await loadHlsEngine();
        if (HlsClass && HlsClass.isSupported()) {
          if (attachedSrcRef.current !== mediaSrc) return;

          markPerformance("ep:manifest:start", videoId);

          const hlsOptions = createStartupHlsConfig(mediaSrc);
          const hls = new HlsClass(hlsOptions);

          hls.loadSource(mediaSrc);
          hls.attachMedia(video);

          hls.on(HlsClass.Events.MANIFEST_PARSED, (_event, data) => {
            markPerformance("ep:manifest:parsed", videoId);
            mediaStateManager.onManifestParsed();
            setHasError(false);
            applyInitialMediaSettings();
            triggerInitialPlaybackIfNeeded();

            if (effectiveDebug) {
              const firstLevel = data.levels?.[data.firstLevel ?? 0];
              const startupLevel = firstLevel?.height ? `${firstLevel.height}p` : "auto";
              const seedKbps = Math.round(getInitialBandwidthEstimate(mediaSrc) / 1000);
              console.log(`[Evandro Player HLS] Manifest Parsed | Startup: ${startupLevel} | Seed: ${seedKbps} kbps`);
            }
          });

          hls.on(HlsClass.Events.FRAG_LOADING, () => {
            markPerformanceOnce("ep:first-frag:start", videoId);
          });

          hls.on(HlsClass.Events.FRAG_LOADED, () => {
            markPerformanceOnce("ep:first-frag:loaded", videoId);
            if (hls.bandwidthEstimate && hls.bandwidthEstimate > 0) {
              saveBandwidthEstimate(mediaSrc, hls.bandwidthEstimate);
            }
          });

          hls.on(HlsClass.Events.FRAG_BUFFERED, () => {
            markPerformanceOnce("ep:first-frag:buffered", videoId);
          });

          hls.on(HlsClass.Events.LEVEL_SWITCHED, (_event, data) => {
            if (effectiveDebug && hls.levels) {
              const levelObj = hls.levels[data.level];
              if (levelObj) {
                const res = levelObj.height ? `${levelObj.height}p` : `Level ${data.level}`;
                const br = Math.round(levelObj.bitrate / 1000);
                const est = Math.round(hls.bandwidthEstimate / 1000);
                console.log(`[Evandro Player HLS] Level Switched: ${res} (${br} kbps) | Bandwidth Est: ${est} kbps`);
              }
            }
            if (hls.bandwidthEstimate && hls.bandwidthEstimate > 0) {
              saveBandwidthEstimate(mediaSrc, hls.bandwidthEstimate);
            }
          });

          hls.on(HlsClass.Events.ERROR, (_event: unknown, data: { fatal?: boolean; type?: string }) => {
            if (data.fatal) {
              console.error("[Evandro Player HLS Fatal Error]", data);
              switch (data.type) {
                case HlsClass.ErrorTypes.NETWORK_ERROR:
                  console.warn("[Evandro Player HLS] Retrying network error...");
                  hls.startLoad();
                  break;
                case HlsClass.ErrorTypes.MEDIA_ERROR:
                  console.warn("[Evandro Player HLS] Recovering media error...");
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  setHasError(true);
                  mediaStateManager.onError();
                  break;
              }
            }
          });

          hlsRef.current = hls as unknown as Hls;
          return;
        }
      } catch (err) {
        console.warn("[Evandro Player] Dynamic HLS load error, falling back to native:", err);
      }
    }

    // 3. Fallback native
    markPerformance("ep:manifest:start", videoId);
    video.src = mediaSrc;
  }, [applyInitialMediaSettings, triggerInitialPlaybackIfNeeded, videoId, effectiveDebug, mediaStateManager, engine, mediaElement]);

  // Attach media source conditionally once per resolved media URL (only when not managed by external engine/stage)
  useEffect(() => {
    if (engine || mediaElement) return;
    if (isMediaAttached && resolvedSrc) {
      attachMediaSource(resolvedSrc);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      attachedSrcRef.current = null;
    };
  }, [resolvedSrc, isMediaAttached, attachMediaSource, engine, mediaElement]);

  // Subscribe to external engine state if provided
  useEffect(() => {
    if (!engine) return;
    const unsubscribe = engine.subscribe((s) => {
      setIsPlaying(s.isPlaying);
      setVolume(s.volume);
      setIsMuted(s.isMuted);
      setPlaybackRate(s.playbackRate);
      if (s.hasFirstFrame) {
        setHasFirstFrameRendered(true);
      }
      if (s.hasError) {
        setHasError(true);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [engine]);

  // Sync native media element events when passed from embed stage
  useEffect(() => {
    if (!mediaElement) return;
    const v = mediaElement;
    const onPlay = () => {
      setIsPlaying(true);
      setIsPlayPending(false);
    };
    const onPause = () => {
      setIsPlaying(false);
      setIsPlayPending(false);
    };
    const onEnded = () => {
      setIsEnded(true);
      setIsPlayPending(false);
    };
    const onPlaying = () => {
      setIsPlaying(true);
      setIsPlayPending(false);
      setHasStartedPlayingForeground(true);
    };
    const onTime = () => {
      if (!isDraggingSeek) setCurrentTime(v.currentTime);
    };
    const onDuration = () => {
      if (Number.isFinite(v.duration)) setDuration(v.duration);
    };
    const onVol = () => {
      setVolume(v.volume);
      setIsMuted(v.muted || v.volume === 0);
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDuration);
    v.addEventListener("volumechange", onVol);

    queueMicrotask(() => {
      if (v.readyState >= 1 && Number.isFinite(v.duration)) {
        setDuration(v.duration);
      }
      setCurrentTime(v.currentTime);
      setIsPlaying(!v.paused);
    });

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDuration);
      v.removeEventListener("volumechange", onVol);
    };
  }, [mediaElement, isDraggingSeek]);

  // Initialize PlayerRuntime and PlaybackController lifecycle once per videoId / debug flag
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
      config: configRef.current,
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
      }
      triggerInitialPlaybackIfNeeded();
    }

    return () => {
      runtimeRef.current = null;
      playbackControllerRef.current?.dispose();
      playbackControllerRef.current = null;
      unsubscribe?.();
      runtime.destroy();
      mediaStateManager.dispose();
    };
  }, [videoId, effectiveDebug, onEvent, onRuntimeReady, isMediaAttached, triggerInitialPlaybackIfNeeded, mediaStateManager]);

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

  // Deduped session activation for background quota tracking
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

  // Main foreground playback activation (seamless preview -> HLS transition with volume restore)
  const activateForegroundPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    markPerformance("ep:user-play", videoId);
    userPlayClickTimestampRef.current = performance.now();
    mediaStateManager.onPlayRequested();

    setUserActivatedForeground(true);
    setIsPlayPending(true);

    if (hasFirstFrameRendered) {
      setHasRevealedVideo(true);
      if (displayPreviewSrc) {
        setIsTransitioningPreviewOut(true);
        setTimeout(() => {
          setIsTransitioningPreviewOut(false);
        }, 140);
      }
    }

    const targetVol = lastVolumeRef.current > 0 ? lastVolumeRef.current : defaultVolume;
    const targetRate = defaultPlaybackRate;

    video.volume = targetVol;
    video.muted = targetVol === 0;
    video.playbackRate = targetRate;
    setVolume(targetVol);
    setIsMuted(targetVol === 0);
    setPlaybackRate(targetRate);

    activateSession();

    if (engine) {
      await engine.startForeground(targetVol);
    } else if (playbackControllerRef.current) {
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
  }, [
    defaultPlaybackRate,
    defaultVolume,
    activateSession,
    videoId,
    mediaStateManager,
    engine,
    displayPreviewSrc,
    hasFirstFrameRendered,
  ]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (playbackMode === "background_autoplay" || !userActivatedForeground) {
      activateForegroundPlayback();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    markPerformance("ep:user-play", videoId);
    userPlayClickTimestampRef.current = performance.now();

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
      activateSession();
      if (video.paused || video.ended) {
        setIsPlayPending(true);
        mediaStateManager.onPlayRequested();
      } else {
        setIsPlayPending(false);
      }
      playbackControllerRef.current.handleUserPlayToggle(lastVolumeRef.current);
      return;
    }

    if (video.paused || video.ended) {
      activateSession();
      setIsPlayPending(true);
      mediaStateManager.onPlayRequested();
      video.play().catch(() => {
        setIsPlayPending(false);
      });
    } else {
      setIsPlayPending(false);
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
    activateSession,
    videoId,
    mediaStateManager,
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
      markPerformance("ep:canplay", videoId);
      if (videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
      mediaStateManager.onCanPlay();
      applyInitialMediaSettings();
      triggerInitialPlaybackIfNeeded();
    }
  };

  const handleCanPlay = () => {
    markPerformance("ep:canplay", videoId);
    if (videoRef.current && videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
      setDuration((prev) => (prev === 0 ? videoRef.current!.duration : prev));
    }
    mediaStateManager.onCanPlay();
    triggerInitialPlaybackIfNeeded();
  };

  const handleWaiting = () => {
    mediaStateManager.onWaiting();
  };

  const handlePlaying = () => {
    mediaStateManager.onPlaying();
    setIsPlaying(true);
    setIsEnded(false);
    setIsPlayPending(false);
    setHasStartedPlayingForeground(true);
  };

  const handlePause = () => {
    mediaStateManager.onPause();
    setIsPlaying(false);
    setIsPlayPending(false);
  };

  const handleEnded = () => {
    mediaStateManager.onEnded();
    setIsPlaying(false);
    setIsEnded(true);
    setIsPlayPending(false);
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
      console.error("[Evandro Player Native Video Error]", video.error);
      setHasError(true);
      mediaStateManager.onError();
    }
  };

  const handleLoadStart = () => {
    if (src && isMediaAttached) {
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

  const isEmbedded = Boolean(mediaElement);

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
      {/* Derived Lightweight Background Preview / Poster Layer (Only in standalone / editor fallback mode) */}
      {!isEmbedded && isPreviewVisible && displayPreviewSrc && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 z-5 pointer-events-none overflow-hidden transition-opacity duration-140 ease-out",
            isTransitioningPreviewOut ? "opacity-0" : "opacity-100"
          )}
        >
          <img
            src={displayPreviewSrc}
            alt=""
            fetchPriority="high"
            onError={() => {
              if (!customThumbError && isCustomStartup) {
                setCustomThumbError(true);
              } else if (!previewError && candidateBgPreview) {
                setPreviewError(true);
              }
            }}
            className="w-full h-full object-cover pointer-events-none select-none"
          />
        </div>
      )}

      {/* Native Video Element (Only rendered when not using pre-existing mediaElement from Stage) */}
      {!isEmbedded && (
        <video
          ref={handleInternalVideoRef}
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
          className={cn(
            "w-full h-full object-contain cursor-pointer transition-opacity duration-140 ease-out",
            hasRevealedVideo ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Loading Buffering Indicator (Delayed trigger via MediaLoadingStateManager) */}
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
              {/* Icon Circle with concentric animated sound waves */}
              <div className="relative flex items-center justify-center size-9 @min-[400px]:size-10 mb-2 shrink-0">
                {/* Concentric sound waves */}
                <span
                  aria-hidden="true"
                  className="ep-sound-wave-1 absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    backgroundColor: "var(--player-accent)",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="ep-sound-wave-2 absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    backgroundColor: "var(--player-accent)",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="ep-sound-wave-3 absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    backgroundColor: "var(--player-accent)",
                  }}
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

              {/* Subtitle / Context */}
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
      {!isPlaying && !isLoading && !hasError && playbackMode !== "background_autoplay" && !userActivatedForeground && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-12 cursor-pointer bg-black/20 transition-opacity"
        >
          <div
            style={{
              backgroundColor: "var(--player-accent)",
              color: "var(--player-accent-foreground)",
            }}
            className="flex size-14 @min-[480px]:size-16 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105"
          >
            <Play className="size-7 @min-[480px]:size-8 ml-1 fill-current" />
          </div>
        </div>
      )}

      {/* Pause Overlay (Custom Pause Thumbnail OR "Continue assistindo" Card) */}
      {!isPlaying && !isPlayPending && !isLoading && !hasError && playbackMode !== "background_autoplay" && hasStartedPlayingForeground && !isEnded && (
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
                className="w-full h-full object-cover select-none pointer-events-none"
              />
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
