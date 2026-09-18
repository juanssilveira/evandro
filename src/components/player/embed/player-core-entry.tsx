import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EmbedPlayer } from "./embed-player";
import EMBED_CSS from "./embed-styles.generated.css";

export interface PlayerMountHandle {
  unmount: () => void;
  update: (videoId: string, apiBase: string) => void;
}

export interface EvandroPlayerCoreRegistry {
  mount: typeof mountEvandroPlayer;
  ready: boolean;
}

interface WindowWithCore extends Window {
  __EVANDRO_PLAYER_CORE__?: EvandroPlayerCoreRegistry;
}

/**
 * Mounts React EmbedPlayer inside the provided shadow root and container.
 * Injects isolated Shadow DOM CSS styles.
 */
export function mountEvandroPlayer(
  container: HTMLDivElement,
  shadowRoot: ShadowRoot,
  videoId: string,
  apiBase: string
): PlayerMountHandle {
  // Check if style is already injected
  if (!shadowRoot.querySelector("style[data-evandro-player-styles]")) {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-evandro-player-styles", "true");
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
  win.__EVANDRO_PLAYER_CORE__ = {
    mount: mountEvandroPlayer,
    ready: true,
  };

  // Dispatch event notifying any pending custom elements
  window.dispatchEvent(new CustomEvent("evandro-player:core-loaded"));
}
