/**
 * WatchMap Player Tiny Loader (Budget <= 25 KB)
 * Ultra-fast bootstrap coordinator, custom element registry, and parallel asset loader.
 */

declare const __WATCHMAP_API_BASE__: string;
declare const __WATCHMAP_CORE_FILENAME__: string;

const API_BASE: string =
  typeof __WATCHMAP_API_BASE__ !== "undefined" ? __WATCHMAP_API_BASE__ : "";
const CORE_FILENAME: string =
  typeof __WATCHMAP_CORE_FILENAME__ !== "undefined" ? __WATCHMAP_CORE_FILENAME__ : "assets/player-core.js";

// 1. Mark loader execution start immediately
if (typeof performance !== "undefined" && performance.mark) {
  try {
    performance.mark("wm:loader:start");
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

export interface WatchMapCoreModule {
  mount: (
    container: HTMLDivElement,
    shadowRoot: ShadowRoot,
    videoId: string,
    apiBase: string
  ) => { unmount: () => void; update: (videoId: string, apiBase: string) => void };
  ready: boolean;
}

export interface WatchMapBootstrapRegistry {
  map: Record<string, Promise<BootstrapVideoData>>;
  fetch: (apiBase: string, videoId: string) => Promise<BootstrapVideoData>;
  preconnect: (url: string) => void;
  preloadVisual: (url: string) => void;
  corePromise: Promise<WatchMapCoreModule> | null;
}

interface WindowWithWatchMap extends Window {
  __WATCHMAP_BOOTSTRAP__?: WatchMapBootstrapRegistry;
  __WATCHMAP_CORE__?: WatchMapCoreModule;
}

const win = (typeof window !== "undefined" ? window : undefined) as WindowWithWatchMap | undefined;

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

function startEarlyBootstrap(apiBase: string, videoId: string): Promise<BootstrapVideoData> {
  const base = (apiBase || "").replace(/\/$/, "");
  const cacheKey = `${base}:${videoId}`;

  if (win?.__WATCHMAP_BOOTSTRAP__?.map[cacheKey]) {
    return win.__WATCHMAP_BOOTSTRAP__.map[cacheKey];
  }

  if (typeof performance !== "undefined" && performance.mark) {
    try {
      performance.mark(`wm:bootstrap:start:${videoId}`);
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
          performance.mark(`wm:bootstrap:end:${videoId}`);
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

  if (win?.__WATCHMAP_BOOTSTRAP__) {
    win.__WATCHMAP_BOOTSTRAP__.map[cacheKey] = promise;
  }
  return promise;
}

function loadPlayerCore(): Promise<WatchMapCoreModule> {
  if (win?.__WATCHMAP_BOOTSTRAP__?.corePromise) {
    return win.__WATCHMAP_BOOTSTRAP__.corePromise;
  }

  if (typeof performance !== "undefined" && performance.mark) {
    try {
      performance.mark("wm:core:start");
    } catch {
      // ignore
    }
  }

  const embedBase = getEmbedBaseUrl();
  const coreUrl = new URL(CORE_FILENAME, embedBase).href;

  const promise = new Promise<WatchMapCoreModule>((resolve, reject) => {
    // If already loaded via script
    if (win?.__WATCHMAP_CORE__?.ready) {
      resolve(win.__WATCHMAP_CORE__);
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = coreUrl;
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = () => {
      if (win?.__WATCHMAP_CORE__) {
        resolve(win.__WATCHMAP_CORE__);
      } else {
        reject(new Error("Core module loaded but __WATCHMAP_CORE__ not found."));
      }
    };

    script.onerror = (err) => {
      console.error("[WatchMap Loader] Failed to load Player Core:", coreUrl, err);
      reject(err);
    };

    document.head.appendChild(script);
  });

  if (win?.__WATCHMAP_BOOTSTRAP__) {
    win.__WATCHMAP_BOOTSTRAP__.corePromise = promise;
  }

  return promise;
}

// Initialize global bootstrap registry
if (win && !win.__WATCHMAP_BOOTSTRAP__) {
  win.__WATCHMAP_BOOTSTRAP__ = {
    map: {},
    fetch: startEarlyBootstrap,
    preconnect: preconnectOrigin,
    preloadVisual: preloadVisualAsset,
    corePromise: null,
  };
}

// 2. Preconnect API Base
if (API_BASE) {
  preconnectOrigin(API_BASE);
}

// 3. Define Custom Element `<watchmap-player>`
export class WatchMapPlayerElement extends HTMLElement {
  public static get observedAttributes(): string[] {
    return ["video-id"];
  }

  private _mountHandle: { unmount: () => void; update: (videoId: string, apiBase: string) => void } | null = null;
  private _mountContainer: HTMLDivElement | null = null;
  private _shadowRoot: ShadowRoot | null = null;
  private _isMounted = false;

  constructor() {
    super();
  }

  public connectedCallback(): void {
    if (!this._shadowRoot) {
      this._shadowRoot = this.attachShadow({ mode: "open" });

      // Create React mount container
      this._mountContainer = document.createElement("div");
      this._mountContainer.className = "watchmap-embed-root";
      this._shadowRoot.appendChild(this._mountContainer);
    }

    const videoId = this.getAttribute("video-id") || "";
    if (videoId) {
      // Kick off early bootstrap in parallel immediately
      startEarlyBootstrap(API_BASE, videoId);
    }

    // Kick off core bundle download in parallel immediately
    loadPlayerCore().catch(() => {});

    this.mountCore();
  }

  public disconnectedCallback(): void {
    if (this._mountHandle) {
      this._mountHandle.unmount();
      this._mountHandle = null;
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

  private async mountCore(): Promise<void> {
    if (this._isMounted || !this._mountContainer || !this._shadowRoot) return;

    const videoId = this.getAttribute("video-id") || "";

    try {
      await loadPlayerCore();

      if (!this._mountContainer || !this._shadowRoot || !this.isConnected) return;

      if (win?.__WATCHMAP_CORE__?.mount) {
        this._mountHandle = win.__WATCHMAP_CORE__.mount(
          this._mountContainer,
          this._shadowRoot,
          videoId,
          API_BASE
        );
        this._isMounted = true;
      }
    } catch (err) {
      console.error("[WatchMap Element] Error mounting player core:", err);
    }
  }
}

// 4. Register Custom Element once
if (typeof window !== "undefined" && !customElements.get("watchmap-player")) {
  customElements.define("watchmap-player", WatchMapPlayerElement);
}

// 5. Scan for existing elements in DOM and start parallel preloading immediately
if (typeof document !== "undefined") {
  const existingElements = document.querySelectorAll("watchmap-player");
  existingElements.forEach((el) => {
    const videoId = el.getAttribute("video-id");
    if (videoId) {
      startEarlyBootstrap(API_BASE, videoId);
    }
  });

  if (existingElements.length > 0) {
    loadPlayerCore().catch(() => {});
  }
}
