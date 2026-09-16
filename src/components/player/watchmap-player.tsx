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
  Settings,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PlayerRuntime,
  type PlayerEventListener,
  type FullscreenInitiator,
} from "./runtime";

interface WatchMapPlayerProps {
  src: string;
  videoId?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  debugEnabled?: boolean;
  onEvent?: PlayerEventListener;
  onRuntimeReady?: (runtime: PlayerRuntime) => void;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

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
  autoPlay = false,
  debugEnabled = false,
  onEvent,
  onRuntimeReady,
}: WatchMapPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<PlayerRuntime | null>(null);

  // Initialize PlayerRuntime lifecycle
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video) return;

    const runtime = new PlayerRuntime(video, {
      videoId,
      debug: debugEnabled,
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
  }, [videoId, debugEnabled, onEvent, onRuntimeReady]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const lastVolumeRef = useRef(1);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (isPlaying && !showSettings && !isDraggingSeek) {
      hideTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying, showSettings, isDraggingSeek]);

  const handleMouseMove = () => {
    showControlsTemporarily();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSettings && !isDraggingSeek) {
      setControlsVisible(false);
    }
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch(() => {
        // Autoplay policy or interrupt
      });
    } else {
      video.pause();
    }
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
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
  }, [isMuted]);

  // Volume drag/click
  const updateVolumeFromPosition = (clientX: number) => {
    const track = volumeTrackRef.current;
    const video = videoRef.current;
    if (!track || !video) return;

    const rect = track.getBoundingClientRect();
    const rawVol = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newVol = Math.round(rawVol * 100) / 100;

    video.volume = newVol;
    video.muted = newVol === 0;
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (newVol > 0) {
      lastVolumeRef.current = newVol;
    }
  };

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    updateVolumeFromPosition(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateVolumeFromPosition(moveEvent.clientX);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
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
    []
  );

  // Double click handler on video container / main area
  const handleContainerDoubleClick = (e: React.MouseEvent) => {
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
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!isDraggingSeek) {
      setCurrentTime(video.currentTime);
    }

    if (video.buffered.length > 0) {
      try {
        const end = video.buffered.end(video.buffered.length - 1);
        setBufferedEnd(end);
      } catch {
        // ignore index errors
      }
    }
  };

  const handleVolumeSync = () => {
    const video = videoRef.current;
    if (!video) return;
    setVolume(video.volume);
    setIsMuted(video.muted || video.volume === 0);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setVolume(video.volume);
    setIsMuted(video.muted || video.volume === 0);
    setIsLoading(false);
  };

  const handleWaiting = () => setIsLoading(true);
  const handlePlaying = () => {
    setIsPlaying(true);
    setIsLoading(false);
    showControlsTemporarily();
  };
  const handlePause = () => {
    setIsPlaying(false);
    setControlsVisible(true);
  };
  const handleEnded = () => {
    setIsPlaying(false);
    setControlsVisible(true);
  };
  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleContainerDoubleClick}
      className={cn(
        "relative w-full aspect-video rounded-xl overflow-hidden bg-black select-none group font-sans flex items-center justify-center border border-border/40 shadow-2xl",
        isFullscreen && "rounded-none border-none max-h-screen",
        className
      )}
    >
      {/* Native Video Element */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        controls={false}
        onClick={togglePlay}
        onLoadStart={handleLoadStart}
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
          <div className="flex size-14 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-primary shadow-lg">
            <Loader2 className="size-8 animate-spin" />
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
              Ocorreu uma falha ao carregar o arquivo do storage. Verifique sua conexão e tente novamente.
            </p>
          </div>
          <button
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <RotateCcw className="size-3.5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Big Play Button Overlay on Pause */}
      {!isPlaying && !isLoading && !hasError && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer bg-black/20 transition-opacity"
        >
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/90 hover:bg-primary text-white shadow-xl transition-transform hover:scale-105">
            <Play className="size-8 ml-1 fill-white" />
          </div>
        </div>
      )}

      {/* Top Title Bar */}
      {title && (
        <div
          className={cn(
            "absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20 pointer-events-none transition-opacity duration-300",
            controlsVisible ? "opacity-100" : "opacity-0"
          )}
        >
          <h2 className="text-sm font-medium text-white/90 truncate drop-shadow">
            {title}
          </h2>
        </div>
      )}

      {/* Bottom Controls Overlay */}
      <div
        data-no-fullscreen="true"
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20 transition-opacity duration-300 flex flex-col gap-2.5",
          controlsVisible || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Seek Bar (Linear, Smooth, No stepping transitions) */}
        <div
          ref={progressTrackRef}
          onMouseDown={handleSeekMouseDown}
          className="relative group/track w-full h-3 flex items-center cursor-pointer py-1"
        >
          {/* Background track */}
          <div className="relative w-full h-1 group-hover/track:h-1.5 bg-white/25 rounded-full overflow-hidden">
            {/* Buffered progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Played progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-primary rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber thumb */}
          <div
            className="absolute size-3.5 rounded-full bg-white shadow-md border border-primary opacity-0 group-hover/track:opacity-100 pointer-events-none"
            style={{
              left: `${progressPercent}%`,
              transform: "translateX(-50%)",
            }}
          />
        </div>

        {/* Control Buttons & Indicators */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Left: Play/Pause, Volume, Time */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded-md hover:bg-white/15 text-white/90 hover:text-white transition-colors focus:outline-none"
              title={isPlaying ? "Pausar (Space)" : "Reproduzir (Space)"}
            >
              {isPlaying ? (
                <Pause className="size-5 fill-white/90" />
              ) : (
                <Play className="size-5 fill-white/90" />
              )}
            </button>

            {/* Volume & Custom Slider */}
            <div className="flex items-center gap-2 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-md hover:bg-white/15 text-white/90 hover:text-white transition-colors focus:outline-none"
                title={isMuted ? "Ativar som (M)" : "Silenciar (M)"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="size-5 text-white/90" />
                ) : volume < 0.5 ? (
                  <Volume1 className="size-5 text-white/90" />
                ) : (
                  <Volume2 className="size-5 text-white/90" />
                )}
              </button>

              <div
                ref={volumeTrackRef}
                onMouseDown={handleVolumeMouseDown}
                className="w-16 h-4 flex items-center cursor-pointer py-1"
                title={`Volume: ${Math.round(effectiveVolume * 100)}%`}
              >
                <div className="relative w-full h-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-primary rounded-full"
                    style={{ width: `${effectiveVolume * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Time Display */}
            <div className="text-xs font-mono text-white/80 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Playback Speed, Fullscreen */}
          <div className="flex items-center gap-2 relative">
            {/* Playback Speed Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 hover:bg-white/15 transition-colors focus:outline-none",
                  playbackRate !== 1 && "text-primary"
                )}
                title="Velocidade de reprodução"
              >
                <Settings className="size-3.5" />
                <span>{playbackRate}x</span>
              </button>

              {/* Speed Popover */}
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 w-32 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg p-1 shadow-2xl z-40 text-xs">
                  <div className="px-2 py-1 text-[10px] uppercase font-semibold text-zinc-400 border-b border-white/10 mb-1">
                    Velocidade
                  </div>
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleRateChange(rate)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/10 text-left transition-colors",
                        playbackRate === rate ? "text-primary font-semibold" : "text-white/80"
                      )}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && <Check className="size-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={() => toggleFullscreen("button")}
              className="p-1.5 rounded-md hover:bg-white/15 text-white/90 hover:text-white transition-colors focus:outline-none"
              title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            >
              {isFullscreen ? (
                <Minimize className="size-5" />
              ) : (
                <Maximize className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
