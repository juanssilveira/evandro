/**
 * Evandro Player Tiny Loader (Budget <= 25 KB)
 * Ultra-fast bootstrap coordinator, custom element registry, and parallel asset loader.
 */

import { shouldUseNativeHls } from "./hls-capabilities";

declare const __EVANDRO_PLAYER_API_BASE__: string;
declare const __EVANDRO_PLAYER_CORE_FILENAME__: string;
declare const __EVANDRO_PLAYER_HLS_FILENAME__: string;

const API_BASE: string =
  typeof __EVANDRO_PLAYER_API_BASE__ !== "undefined" ? __EVANDRO_PLAYER_API_BASE__ : "";
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
    };
    playback?: {
      backgroundAutoplay?: boolean;
    };
  };
}

export interface EvandroPlayerCoreModule {
  mount: (
    container: HTMLDivElement,
    shadowRoot: ShadowRoot,
    videoId: string,
    apiBase: string
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
  corePromise: Promise<EvandroPlayerCoreModule> | null;
}

interface WindowWithEvandroPlayer extends Window {
  __EVANDRO_PLAYER_BOOTSTRAP__?: EvandroPlayerBootstrapRegistry;
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

      // Warm primary visual asset
      if (json.config?.playback?.backgroundAutoplay && json.backgroundPreviewUrl) {
        preloadVisualAsset(json.backgroundPreviewUrl);
      } else if (json.posterUrl) {
        preloadVisualAsset(json.posterUrl);
      }

      return json;
    });

  if (win?.__EVANDRO_PLAYER_BOOTSTRAP__) {
    win.__EVANDRO_PLAYER_BOOTSTRAP__.map[cacheKey] = promise;
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
    // If already loaded via script
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

// Initialize global bootstrap registry with resolved storage
if (win && !win.__EVANDRO_PLAYER_BOOTSTRAP__) {
  win.__EVANDRO_PLAYER_BOOTSTRAP__ = {
    map: {},
    resolved: {},
    fetch: startEarlyBootstrap,
    preconnect: preconnectOrigin,
    preloadVisual: preloadVisualAsset,
    preloadHls: preloadHlsEngine,
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
  private _mountContainer: HTMLDivElement | null = null;
  private _shadowRoot: ShadowRoot | null = null;
  private _shellElement: HTMLDivElement | null = null;
  private _isMounted = false;

  constructor() {
    super();
  }

  public connectedCallback(): void {
    if (!this._shadowRoot) {
      this._shadowRoot = this.attachShadow({ mode: "open" });

      // Create React mount container
      this._mountContainer = document.createElement("div");
      this._mountContainer.className = "evandro-player-embed-root";
      this._shadowRoot.appendChild(this._mountContainer);
    }

    const videoId = this.getAttribute("video-id") || "";
    if (videoId) {
      // Kick off early bootstrap in parallel immediately
      const bootstrapPromise = startEarlyBootstrap(API_BASE, videoId);

      // Render lightweight visual shell in Shadow DOM if bootstrap resolves before Core mounts
      bootstrapPromise
        .then((data) => {
          if (!this._isMounted && this._shadowRoot && !this._shellElement) {
            this.renderVisualShell(data);
          }
        })
        .catch(() => {});
    }

    // Kick off core bundle download and HLS engine preload in parallel immediately
    preloadHlsEngine();
    loadPlayerCore().catch(() => {});

    this.mountCore();
  }

  public disconnectedCallback(): void {
    if (this._mountHandle) {
      this._mountHandle.unmount();
      this._mountHandle = null;
    }
    if (this._shellElement) {
      this._shellElement.remove();
      this._shellElement = null;
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
        startEarlyBootstrap(API_BASE, videoId);
      }
      if (this._mountHandle) {
        this._mountHandle.update(videoId, API_BASE);
      } else {
        this.mountCore();
      }
    }
  }

  private renderVisualShell(data: BootstrapVideoData): void {
    if (this._isMounted || !this._shadowRoot || this._shellElement) return;

    const isBg = Boolean(data.config?.playback?.backgroundAutoplay);
    const previewSrc = isBg
      ? data.backgroundPreviewUrl || data.posterUrl
      : data.posterUrl || data.backgroundPreviewUrl;

    const shell = document.createElement("div");
    shell.setAttribute("data-evandro-player-shell", "true");
    shell.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:12px;z-index:0;pointer-events:none;";

    if (previewSrc) {
      const img = document.createElement("img");
      img.src = previewSrc;
      img.alt = "";
      img.style.cssText = "width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;";
      shell.appendChild(img);
    }

    this._shellElement = shell;
    // Prepend shell behind the mount container so Core takes over smoothly
    this._shadowRoot.insertBefore(shell, this._mountContainer);
  }

  private async mountCore(): Promise<void> {
    if (this._isMounted || !this._mountContainer || !this._shadowRoot) return;

    const videoId = this.getAttribute("video-id") || "";

    try {
      await loadPlayerCore();

      if (!this._mountContainer || !this._shadowRoot || !this.isConnected) return;

      if (win?.__EVANDRO_PLAYER_CORE__?.mount) {
        this._mountHandle = win.__EVANDRO_PLAYER_CORE__.mount(
          this._mountContainer,
          this._shadowRoot,
          videoId,
          API_BASE
        );
        this._isMounted = true;

        // Clean up visual shell once React has mounted
        if (this._shellElement) {
          const shell = this._shellElement;
          this._shellElement = null;
          // Short timeout to guarantee zero black flash while React finishes first paint
          setTimeout(() => {
            shell.remove();
          }, 100);
        }
      }
    } catch (err) {
      console.error("[Evandro Player Element] Error mounting player core:", err);
    }
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
    loadPlayerCore().catch(() => {});
  }
}
