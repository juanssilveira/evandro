/**
 * Evandro Player — Canonical Startup Visual Resolver & Surface Manager
 * Pure TypeScript, zero React dependencies, ultra-lightweight.
 */

export type StartupVisualType = "preview" | "custom" | "provider" | "none";

export interface ResolvedStartupVisual {
  type: StartupVisualType;
  url: string | null;
  fallbackUrl: string | null;
}

export function resolveAssetUrl(
  url: string | null | undefined,
  apiBase?: string
): string | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  const base = (
    apiBase ||
    (typeof window !== "undefined" && window.location ? window.location.origin : "")
  ).replace(/\/$/, "");

  if (!base) return trimmed;
  return `${base}/${trimmed.replace(/^\//, "")}`;
}

export interface ResolveStartupVisualParams {
  backgroundAutoplay?: boolean;
  thumbnailEnabled?: boolean;
  thumbnailSource?: "provider" | "custom";
  customUrl?: string | null;
  posterUrl?: string | null;
  backgroundPreviewUrl?: string | null;
  apiBase?: string;
}

/**
 * Single Canonical Resolution Policy for Startup Visuals:
 * 1. BG ON + preview exists → Background Preview (NEVER fallback to thumbnail/poster)
 * 2. BG ON without preview → none / black
 * 3. BG OFF + Thumbnail OFF → none / black
 * 4. BG OFF + Thumbnail ON + source custom + customUrl → custom (absolute priority)
 * 5. BG OFF + Thumbnail ON + provider → poster
 */
export function resolveStartupVisual(
  params: ResolveStartupVisualParams
): ResolvedStartupVisual {
  const isBg = Boolean(params.backgroundAutoplay);
  const isThumbEnabled = params.thumbnailEnabled ?? true;
  const apiBase = params.apiBase;

  // 1. Background Autoplay ON
  if (isBg) {
    const previewUrl = resolveAssetUrl(params.backgroundPreviewUrl, apiBase);
    if (previewUrl) {
      return {
        type: "preview",
        url: previewUrl,
        fallbackUrl: null,
      };
    }
    return {
      type: "none",
      url: null,
      fallbackUrl: null,
    };
  }

  // 2. Background Autoplay OFF + Thumbnail OFF
  if (!isThumbEnabled) {
    return {
      type: "none",
      url: null,
      fallbackUrl: null,
    };
  }

  // 3. Background Autoplay OFF + Thumbnail ON
  const resolvedCustomUrl = resolveAssetUrl(params.customUrl, apiBase);
  const resolvedPosterUrl = resolveAssetUrl(params.posterUrl, apiBase);

  if (params.thumbnailSource === "custom") {
    if (resolvedCustomUrl) {
      return {
        type: "custom",
        url: resolvedCustomUrl,
        fallbackUrl: resolvedPosterUrl,
      };
    }
    // If source custom was set but customUrl is empty/null, fall back to provider poster
    if (resolvedPosterUrl) {
      return {
        type: "provider",
        url: resolvedPosterUrl,
        fallbackUrl: null,
      };
    }
    return {
      type: "none",
      url: null,
      fallbackUrl: null,
    };
  }

  // Default / provider source
  if (resolvedPosterUrl) {
    return {
      type: "provider",
      url: resolvedPosterUrl,
      fallbackUrl: null,
    };
  }

  return {
    type: "none",
    url: null,
    fallbackUrl: null,
  };
}

export function resolveStartupVisualFromConfig(params: {
  config?: {
    playback?: { backgroundAutoplay?: boolean };
    appearance?: {
      thumbnail?: {
        enabled?: boolean;
        source?: "provider" | "custom";
        customUrl?: string | null;
      };
    };
  } | null;
  backgroundAutoplay?: boolean;
  thumbnailEnabled?: boolean;
  posterUrl?: string | null;
  backgroundPreviewUrl?: string | null;
  apiBase?: string;
}): ResolvedStartupVisual {
  const thumbConfig = params.config?.appearance?.thumbnail;
  const isBg =
    params.backgroundAutoplay ?? Boolean(params.config?.playback?.backgroundAutoplay);
  const isThumbEnabled =
    params.thumbnailEnabled ?? thumbConfig?.enabled ?? true;
  const thumbSource = thumbConfig?.source ?? "provider";
  const customUrl = thumbConfig?.customUrl;

  return resolveStartupVisual({
    backgroundAutoplay: isBg,
    thumbnailEnabled: isThumbEnabled,
    thumbnailSource: thumbSource,
    customUrl,
    posterUrl: params.posterUrl,
    backgroundPreviewUrl: params.backgroundPreviewUrl,
    apiBase: params.apiBase,
  });
}

/**
 * Fast, idempotent CSS background surface application.
 * Never causes broken image glyphs and avoids re-applying if the element is already primed.
 */
export function applyStartupVisualSurface(
  el: HTMLElement | null,
  visual: ResolvedStartupVisual
): void {
  if (!el) return;

  if (visual.type === "none" || !visual.url) {
    el.removeAttribute("data-startup-url");
    el.removeAttribute("data-startup-type");
    el.style.backgroundImage = "none";
    el.style.display = "none";
    return;
  }

  const currentUrl = el.getAttribute("data-startup-url");
  // If already primed with the same URL, adopt seamlessly without modifying style attributes
  if (currentUrl === visual.url && el.style.display === "flex") {
    return;
  }

  el.setAttribute("data-startup-url", visual.url);
  el.setAttribute("data-startup-type", visual.type);
  el.style.display = "flex";
  el.style.opacity = "1";
  el.style.transition = "none";
  el.style.backgroundSize = "cover";
  el.style.backgroundPosition = "center";
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundColor = "#000";
  el.style.backgroundImage = `url("${visual.url}")`;
}

/**
 * Idempotent clean teardown of startup visual surface.
 */
export function releaseStartupVisualSurface(el: HTMLElement | null): void {
  if (!el) return;
  el.removeAttribute("data-startup-url");
  el.removeAttribute("data-startup-type");
  el.style.transition = "opacity 70ms ease-out";
  el.style.opacity = "0";

  setTimeout(() => {
    if (el && !el.getAttribute("data-startup-url")) {
      el.innerHTML = "";
      el.style.backgroundImage = "none";
      el.style.backgroundSize = "";
      el.style.backgroundPosition = "";
      el.style.backgroundRepeat = "";
      el.style.display = "none";
    }
  }, 75);
}
