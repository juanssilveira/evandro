import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EmbedPlayer } from "./embed-player";
import EMBED_CSS from "./embed-styles.generated.css";

export interface PlayerMountHandle {
  unmount: () => void;
  update: (videoId: string, apiBase: string) => void;
}

export interface WatchMapCoreRegistry {
  mount: typeof mountWatchMapPlayer;
  ready: boolean;
}

interface WindowWithCore extends Window {
  __WATCHMAP_CORE__?: WatchMapCoreRegistry;
}

/**
 * Mounts React EmbedPlayer inside the provided shadow root and container.
 * Injects isolated Shadow DOM CSS styles.
 */
export function mountWatchMapPlayer(
  container: HTMLDivElement,
  shadowRoot: ShadowRoot,
  videoId: string,
  apiBase: string
): PlayerMountHandle {
  // Check if style is already injected
  if (!shadowRoot.querySelector("style[data-wm-styles]")) {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-wm-styles", "true");
    styleEl.textContent = String(EMBED_CSS);
    shadowRoot.prepend(styleEl);
  }

  const root: Root = createRoot(container);

  root.render(<EmbedPlayer videoId={videoId} apiBase={apiBase} />);

  return {
    unmount: () => {
      root.unmount();
    },
    update: (newVideoId: string, newApiBase: string) => {
      root.render(<EmbedPlayer videoId={newVideoId} apiBase={newApiBase} />);
    },
  };
}

// Global registry for loader coordination
if (typeof window !== "undefined") {
  const win = window as WindowWithCore;
  win.__WATCHMAP_CORE__ = {
    mount: mountWatchMapPlayer,
    ready: true,
  };

  // Dispatch event notifying any pending custom elements
  window.dispatchEvent(new CustomEvent("watchmap:core-loaded"));
}
