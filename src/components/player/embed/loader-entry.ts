/**
 * Evandro Player Tiny Loader (Budget <= 25 KB)
 * Ultra-fast bootstrap coordinator, custom element registry, persistent stage creator,
 * and parallel early media engine initializer.
 */

import { shouldUseNativeHls } from "./hls-capabilities";
import type { PlayerEngine } from "../engine/player-engine";
import type { EngineSourceOptions } from "../engine/types";
import type { EvandroPlayerEngineModule } from "../engine/player-engine-entry";
import type { PlayerConfig } from "@/types/player-config";
import {
  resolveStartupVisualFromConfig,
  applyStartupVisualSurface,
} from "../engine/startup-visual-resolver";
import { getSavedResume } from "@/lib/player/resume-storage";

declare const __EVANDRO_PLAYER_API_BASE__: string;
declare const __EVANDRO_PLAYER_ENGINE_FILENAME__: string;
declare const __EVANDRO_PLAYER_CORE_FILENAME__: string;
declare const __EVANDRO_PLAYER_HLS_FILENAME__: string;

const API_BASE: string =
  typeof __EVANDRO_PLAYER_API_BASE__ !== "undefined" ? __EVANDRO_PLAYER_API_BASE__ : "";
const ENGINE_FILENAME: string =
  typeof __EVANDRO_PLAYER_ENGINE_FILENAME__ !== "undefined" ? __EVANDRO_PLAYER_ENGINE_FILENAME__ : "assets/player-engine.js";
const CORE_FILENAME: string =
  typeof __EVANDRO_PLAYER_CORE_FILENAME__ !== "undefined" ? __EVANDRO_PLAYER_CORE_FILENAME__ : "assets/player-core.js";
const HLS_FILENAME: string =
  typeof __EVANDRO_PLAYER_HLS_FILENAME__ !== "undefined" ? __EVANDRO_PLAYER_HLS_FILENAME__ : "";

// 1. Mark loader execution start immediately
if (typeof performance !== "undefined" && performance.mark) {
  try {
    performance.mark("ep:loader:start");
  } catch {
    // ignore
  }
}

export interface BootstrapVideoData {
  videoId: string;
  title: string;
  duration: number | null;
  playbackUrl?: string | null;
  playback?: {
    type: string;
    url: string;
  };
  posterUrl: string | null;
  backgroundPreviewUrl: string | null;
  config?: {
    appearance?: {
      aspectRatio?: string;
      borderRadius?: number;
      thumbnail?: {
        enabled?: boolean;
        source?: "provider" | "custom";
        customUrl?: string | null;
        customKey?: string | null;
        customAspectRatio?: string | null;
        showPlayButton?: boolean;
      };
      pauseThumbnail?: {
        enabled?: boolean;
        customUrl?: string | null;
        customKey?: string | null;
        customAspectRatio?: string | null;
        showPlayButton?: boolean;
      };
    };
    playback?: {
      backgroundAutoplay?: boolean;
      persistentResume?: boolean;
    };
    development?: {
      debug?: boolean;
    };
  };
}

export interface PlayerMountContext {
  mediaElement: HTMLVideoElement;
  engine: PlayerEngine;
  stageElement: HTMLDivElement;
}

export interface EvandroPlayerCoreModule {
  mount: (
    container: HTMLElement,
    shadowRoot: ShadowRoot,
    videoId: string,
    apiBase: string,
    context?: PlayerMountContext
  ) => { unmount: () => void; update: (videoId: string, apiBase: string) => void };
  ready: boolean;
}

export interface EvandroPlayerBootstrapRegistry {
  map: Record<string, Promise<BootstrapVideoData>>;
  resolved: Record<string, BootstrapVideoData>;
  fetch: (apiBase: string, videoId: string) => Promise<BootstrapVideoData>;
  preconnect: (url: string) => void;
  preloadVisual: (url: string) => void;
  preloadHls: () => void;
  enginePromise: Promise<EvandroPlayerEngineModule> | null;
  corePromise: Promise<EvandroPlayerCoreModule> | null;
}

interface WindowWithEvandroPlayer extends Window {
  __EVANDRO_PLAYER_BOOTSTRAP__?: EvandroPlayerBootstrapRegistry;
  __EVANDRO_PLAYER_ENGINE__?: EvandroPlayerEngineModule;
  __EVANDRO_PLAYER_CORE__?: EvandroPlayerCoreModule;
}

const win = (typeof window !== "undefined" ? window : undefined) as WindowWithEvandroPlayer | undefined;

function preconnectOrigin(origin: string): void {
  if (typeof document === "undefined" || !origin) return;
  try {
    const urlObj = new URL(origin, window.location.href);
    const resolvedOrigin = urlObj.origin;

    if (document.querySelector(`link[rel="preconnect"][href="${resolvedOrigin}"]`)) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = resolvedOrigin;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch {
    // ignore
  }
}

function preloadVisualAsset(url: string): void {
  if (typeof document === "undefined" || !url) return;
  try {
    if (document.querySelector(`link[rel="preload"][href="${url}"]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = url;
    (link as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = "high";
    document.head.appendChild(link);
  } catch {
    // ignore
  }
}

function getEmbedBaseUrl(): string {
  if (typeof document !== "undefined") {
    const current = document.currentScript as HTMLScriptElement | null;
    if (current && current.src) {
      try {
        const u = new URL(current.src);
        const p = u.pathname;
        const lastSlash = p.lastIndexOf("/");
        return u.origin + (lastSlash !== -1 ? p.substring(0, lastSlash + 1) : "/embed/v1/");
      } catch {
        // ignore
      }
    }
  }
  return (API_BASE || "").replace(/\/$/, "") + "/embed/v1/";
}

/**
 * Early preloads HLS.js chunk via modulepreload in MSE browsers (non-Safari).
 * Safari / Apple WebKit natively bypasses HLS.js to save bandwidth and memory.
 */
function preloadHlsEngine(): void {
  if (typeof document === "undefined" || !HLS_FILENAME) return;
  if (shouldUseNativeHls()) return;

  try {
    const embedBase = getEmbedBaseUrl();
    const hlsUrl = new URL(HLS_FILENAME, embedBase).href;

    if (
      document.querySelector(`link[rel="modulepreload"][href="${hlsUrl}"]`) ||
      document.querySelector(`link[rel="preload"][href="${hlsUrl}"]`)
    ) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = hlsUrl;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch {
    // ignore
  }
}

function startEarlyBootstrap(apiBase: string, videoId: string): Promise<BootstrapVideoData> {
  const base = (apiBase || "").replace(/\/$/, "");
  const cacheKey = `${base}:${videoId}`;

  if (win?.__EVANDRO_PLAYER_BOOTSTRAP__?.map[cacheKey]) {
    return win.__EVANDRO_PLAYER_BOOTSTRAP__.map[cacheKey];
  }

  if (typeof performance !== "undefined" && performance.mark) {
    try {
      performance.mark(`ep:bootstrap:start:${videoId}`);
    } catch {
      // ignore
    }
  }

  const url = `${base}/api/embed/videos/${encodeURIComponent(videoId)}`;

  const promise = fetch(url, {
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (res) => {
      if (typeof performance !== "undefined" && performance.mark) {
        try {
          performance.mark(`ep:bootstrap:end:${videoId}`);
        } catch {
          // ignore
        }
      }

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        throw { status: 403, message: errData.error || "Este vídeo está temporariamente indisponível." };
      }
      if (res.status === 404) {
        const errData = await res.json().catch(() => ({}));
        throw { status: 404, message: errData.error || "Vídeo não encontrado ou indisponível." };
      }
      if (!res.ok) {
        throw { status: res.status, message: `HTTP error ${res.status}` };
      }
      return res.json() as Promise<BootstrapVideoData>;
    })
    .then((json) => {
      // Store resolved data immediately for synchronous hydration in Core
      if (win?.__EVANDRO_PLAYER_BOOTSTRAP__) {
        win.__EVANDRO_PLAYER_BOOTSTRAP__.resolved[cacheKey] = json;
      }

      // Warm provider CDN connection dynamically
      const playbackUrl = json.playback?.url || json.playbackUrl;
      if (playbackUrl) {
        try {
          const providerOrigin = new URL(playbackUrl).origin;
          preconnectOrigin(providerOrigin);
        } catch {
          // ignore
        }
      }

      // Canonical Startup Visual Preload (no wait, instant fire)
      // Do NOT preload visual assets if a valid resume position exists locally
      const savedResume = getSavedResume(videoId);
      const persistentResumeEnabled = json.config?.playback?.persistentResume ?? true;

      if (!savedResume || !persistentResumeEnabled) {
        const visual = resolveStartupVisualFromConfig({
          config: json.config,
          posterUrl: json.posterUrl,
          backgroundPreviewUrl: json.backgroundPreviewUrl,
          apiBase: API_BASE,
        });

        if (visual.url) {
          preloadVisualAsset(visual.url);
        }
      }

      return json;
    });

  if (win?.__EVANDRO_PLAYER_BOOTSTRAP__) {
    win.__EVANDRO_PLAYER_BOOTSTRAP__.map[cacheKey] = promise;
  }
  return promise;
}

function loadPlayerEngineModule(): Promise<EvandroPlayerEngineModule> {
  if (win?.__EVANDRO_PLAYER_BOOTSTRAP__?.enginePromise) {
    return win.__EVANDRO_PLAYER_BOOTSTRAP__.enginePromise;
  }

  const embedBase = getEmbedBaseUrl();
  const engineUrl = new URL(ENGINE_FILENAME, embedBase).href;

  const promise = new Promise<EvandroPlayerEngineModule>((resolve, reject) => {
    if (win?.__EVANDRO_PLAYER_ENGINE__?.ready) {
      resolve(win.__EVANDRO_PLAYER_ENGINE__);
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = engineUrl;
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = () => {
      if (win?.__EVANDRO_PLAYER_ENGINE__) {
        resolve(win.__EVANDRO_PLAYER_ENGINE__);
      } else {
        reject(new Error("Engine module loaded but __EVANDRO_PLAYER_ENGINE__ not found."));
      }
    };

    script.onerror = (err) => {
      console.error("[Evandro Player Loader] Failed to load Player Engine:", engineUrl, err);
      reject(err);
    };

    document.head.appendChild(script);
  });

  if (win?.__EVANDRO_PLAYER_BOOTSTRAP__) {
    win.__EVANDRO_PLAYER_BOOTSTRAP__.enginePromise = promise;
  }

  return promise;
}

function loadPlayerCore(): Promise<EvandroPlayerCoreModule> {
  if (win?.__EVANDRO_PLAYER_BOOTSTRAP__?.corePromise) {
    return win.__EVANDRO_PLAYER_BOOTSTRAP__.corePromise;
  }

  if (typeof performance !== "undefined" && performance.mark) {
    try {
      performance.mark("ep:core:start");
    } catch {
      // ignore
    }
  }

  const embedBase = getEmbedBaseUrl();
  const coreUrl = new URL(CORE_FILENAME, embedBase).href;

  const promise = new Promise<EvandroPlayerCoreModule>((resolve, reject) => {
    if (win?.__EVANDRO_PLAYER_CORE__?.ready) {
      resolve(win.__EVANDRO_PLAYER_CORE__);
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = coreUrl;
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = () => {
      if (win?.__EVANDRO_PLAYER_CORE__) {
        resolve(win.__EVANDRO_PLAYER_CORE__);
      } else {
        reject(new Error("Core module loaded but __EVANDRO_PLAYER_CORE__ not found."));
      }
    };

    script.onerror = (err) => {
      console.error("[Evandro Player Loader] Failed to load Player Core:", coreUrl, err);
      reject(err);
    };

    document.head.appendChild(script);
  });

  if (win?.__EVANDRO_PLAYER_BOOTSTRAP__) {
    win.__EVANDRO_PLAYER_BOOTSTRAP__.corePromise = promise;
  }

  return promise;
}

// Initialize global bootstrap registry
if (win && !win.__EVANDRO_PLAYER_BOOTSTRAP__) {
  win.__EVANDRO_PLAYER_BOOTSTRAP__ = {
    map: {},
    resolved: {},
    fetch: startEarlyBootstrap,
    preconnect: preconnectOrigin,
    preloadVisual: preloadVisualAsset,
    preloadHls: preloadHlsEngine,
    enginePromise: null,
    corePromise: null,
  };
}

// 2. Preconnect API Base & Early Warm HLS Chunk in parallel
if (API_BASE) {
  preconnectOrigin(API_BASE);
}
preloadHlsEngine();

// 3. Define Custom Element `<evandro-player>`
export class EvandroPlayerElement extends HTMLElement {
  public static get observedAttributes(): string[] {
    return ["video-id"];
  }

  private _mountHandle: { unmount: () => void; update: (videoId: string, apiBase: string) => void } | null = null;
  private _shadowRoot: ShadowRoot | null = null;
  private _stageElement: HTMLDivElement | null = null;
  private _mediaLayer: HTMLDivElement | null = null;
  private _videoElement: HTMLVideoElement | null = null;
  private _startupVisualElement: HTMLDivElement | null = null;
  private _uiRoot: HTMLDivElement | null = null;
  private _engine: PlayerEngine | null = null;
  private _isMounted = false;

  constructor() {
    super();
  }

  public connectedCallback(): void {
    // Synchronously create persistent Stage and Video Element before any async work
    if (!this._shadowRoot) {
      this._shadowRoot = this.attachShadow({ mode: "open" });

      // 1. Stage container
      const stage = document.createElement("div");
      stage.setAttribute("data-evandro-player-stage", "true");
      stage.style.cssText =
        "position:relative;width:100%;height:100%;background:#000;border-radius:inherit;overflow:hidden;display:flex;align-items:center;justify-content:center;";

      // 2. Media layer & persistent single HTMLVideoElement
      const mediaLayer = document.createElement("div");
      mediaLayer.setAttribute("data-evandro-player-media-layer", "true");
      mediaLayer.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;";

      const video = document.createElement("video");
      video.setAttribute("data-evandro-player-media", "true");
      video.playsInline = true;
      video.preload = "auto";
      video.style.cssText = "width:100%;height:100%;object-fit:contain;cursor:pointer;";
      mediaLayer.appendChild(video);

      // 3. Startup visual container
      const startupVisual = document.createElement("div");
      startupVisual.setAttribute("data-evandro-player-startup-visual", "true");
      startupVisual.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:inherit;";

      // 4. UI Root for React Core mounting
      const uiRoot = document.createElement("div");
      uiRoot.setAttribute("data-evandro-player-ui-root", "true");
      uiRoot.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:auto;";

      stage.appendChild(mediaLayer);
      stage.appendChild(startupVisual);
      stage.appendChild(uiRoot);
      this._shadowRoot.appendChild(stage);

      this._stageElement = stage;
      this._mediaLayer = mediaLayer;
      this._videoElement = video;
      this._startupVisualElement = startupVisual;
      this._uiRoot = uiRoot;
    }

    const videoId = this.getAttribute("video-id") || "";

    // Parallel bootstrap, engine, core, and HLS prewarm
    preloadHlsEngine();

    // 1. Load Engine module & create stable PlayerEngine instance immediately
    const engineModulePromise = loadPlayerEngineModule();
    const engineReadyPromise = engineModulePromise
      .then((engineModule) => {
        if (!this.isConnected || !this._videoElement || !this._stageElement || !this._startupVisualElement) {
          return null;
        }
        if (!this._engine) {
          this._engine = engineModule.create({
            videoElement: this._videoElement,
            stageElement: this._stageElement,
            startupVisualElement: this._startupVisualElement,
            debug: false,
          });
        }
        return this._engine;
      })
      .catch((err) => {
        console.error("[Evandro Player Loader] Failed to initialize Player Engine:", err);
        return null;
      });

    // 2. Early Media Initialization & Startup Visual Priming:
    // Tiny Loader primes the visual surface immediately when bootstrap resolves, before waiting for Engine or Core.
    if (videoId) {
      const savedResume = getSavedResume(videoId);
      const bootstrapPromise = startEarlyBootstrap(API_BASE, videoId);

      bootstrapPromise
        .then((bootstrapData) => {
          if (!this.isConnected || !this._startupVisualElement || !bootstrapData) return;
          if (this._engine && this._engine.state.startupVisualState === "released") return;

          const persistentResumeEnabled =
            bootstrapData.config?.playback?.persistentResume ?? true;
          const isResumeEligible = Boolean(savedResume && persistentResumeEnabled);

          if (!isResumeEligible) {
            const visual = resolveStartupVisualFromConfig({
              config: bootstrapData.config,
              posterUrl: bootstrapData.posterUrl,
              backgroundPreviewUrl: bootstrapData.backgroundPreviewUrl,
              apiBase: API_BASE,
            });

            applyStartupVisualSurface(this._startupVisualElement, visual);
          } else {
            applyStartupVisualSurface(this._startupVisualElement, {
              type: "none",
              url: null,
              fallbackUrl: null,
            });
          }
        })
        .catch(() => {});

      Promise.all([bootstrapPromise, engineReadyPromise])
        .then(([bootstrapData, engine]) => {
          if (!this.isConnected || !engine || !bootstrapData) return;

          const persistentResumeEnabled =
            bootstrapData.config?.playback?.persistentResume ?? true;
          const resumePosition =
            persistentResumeEnabled && savedResume ? savedResume.position : null;

          const playbackUrl = bootstrapData.playback?.url || bootstrapData.playbackUrl;
          if (playbackUrl) {
            const engineOptions: EngineSourceOptions = {
              videoId: bootstrapData.videoId || videoId,
              playbackUrl,
              backgroundAutoplay: Boolean(bootstrapData.config?.playback?.backgroundAutoplay),
              resumePosition,
              thumbnailEnabled: bootstrapData.config?.appearance?.thumbnail?.enabled ?? true,
              posterUrl: bootstrapData.posterUrl,
              backgroundPreviewUrl: bootstrapData.backgroundPreviewUrl,
              config: bootstrapData.config as unknown as PlayerConfig,
              apiBase: API_BASE,
            };

            engine.loadSource(engineOptions).catch((err) => {
              console.error("[Evandro Player Loader] Early engine loadSource error:", err);
            });
          }
        })
        .catch(() => {});
    }

    // 3. Mount React Core into UI Root: coreReady + engineReady -> Core mount
    // Core does NOT wait for bootstrap, only for a real, stable PlayerEngine instance
    const corePromise = loadPlayerCore().catch((err) => {
      console.error("[Evandro Player Loader] Failed to load Player Core:", err);
      return null;
    });

    Promise.all([corePromise, engineReadyPromise])
      .then(([coreModule, engine]) => {
        if (!this.isConnected || !coreModule || !engine) return;
        this.mountCoreWithEngine(coreModule, engine);
      })
      .catch((err) => {
        console.error("[Evandro Player Loader] Core mount coordination error:", err);
      });
  }

  public disconnectedCallback(): void {
    if (this._mountHandle) {
      this._mountHandle.unmount();
      this._mountHandle = null;
    }
    if (this._engine) {
      this._engine.destroy();
      this._engine = null;
    }
    this._isMounted = false;
  }

  public attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (oldValue !== newValue && this._shadowRoot) {
      const videoId = newValue || "";
      if (videoId) {
        const savedResume = getSavedResume(videoId);
        startEarlyBootstrap(API_BASE, videoId)
          .then((data) => {
            if (!this.isConnected || !data) return;
            const persistentResumeEnabled =
              data.config?.playback?.persistentResume ?? true;
            const isResumeEligible = Boolean(savedResume && persistentResumeEnabled);

            if (this._startupVisualElement && (!this._engine || this._engine.state.startupVisualState !== "released")) {
              if (!isResumeEligible) {
                const visual = resolveStartupVisualFromConfig({
                  config: data.config,
                  posterUrl: data.posterUrl,
                  backgroundPreviewUrl: data.backgroundPreviewUrl,
                  apiBase: API_BASE,
                });
                applyStartupVisualSurface(this._startupVisualElement, visual);
              } else {
                applyStartupVisualSurface(this._startupVisualElement, {
                  type: "none",
                  url: null,
                  fallbackUrl: null,
                });
              }
            }

            const playbackUrl = data.playback?.url || data.playbackUrl;
            if (playbackUrl && this._engine) {
              this._engine.loadSource({
                videoId: data.videoId || videoId,
                playbackUrl,
                backgroundAutoplay: Boolean(data.config?.playback?.backgroundAutoplay),
                resumePosition: isResumeEligible && savedResume ? savedResume.position : null,
                thumbnailEnabled: data.config?.appearance?.thumbnail?.enabled ?? true,
                posterUrl: data.posterUrl,
                backgroundPreviewUrl: data.backgroundPreviewUrl,
                config: data.config as unknown as PlayerConfig,
                apiBase: API_BASE,
              });
            }
          })
          .catch(() => {});
      }

      if (this._mountHandle) {
        this._mountHandle.update(videoId, API_BASE);
      }
    }
  }

  private mountCoreWithEngine(
    coreModule: EvandroPlayerCoreModule,
    engine: PlayerEngine
  ): void {
    if (this._isMounted || !this._uiRoot || !this._shadowRoot || !this._stageElement || !this._videoElement || !this.isConnected) return;

    const videoId = this.getAttribute("video-id") || "";

    const mountContext: PlayerMountContext = {
      mediaElement: this._videoElement,
      engine: engine,
      stageElement: this._stageElement,
    };

    this._mountHandle = coreModule.mount(
      this._uiRoot,
      this._shadowRoot,
      videoId,
      API_BASE,
      mountContext
    );
    this._isMounted = true;
  }
}

// 4. Register Custom Element once
if (typeof window !== "undefined" && !customElements.get("evandro-player")) {
  customElements.define("evandro-player", EvandroPlayerElement);
}

// 5. Scan for existing elements in DOM and start parallel preloading immediately
if (typeof document !== "undefined") {
  const existingElements = document.querySelectorAll("evandro-player");
  existingElements.forEach((el) => {
    const videoId = el.getAttribute("video-id");
    if (videoId) {
      startEarlyBootstrap(API_BASE, videoId);
    }
  });

  if (existingElements.length > 0) {
    preloadHlsEngine();
    loadPlayerEngineModule().catch(() => {});
    loadPlayerCore().catch(() => {});
  }
}
