import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EmbedPlayer } from "./embed-player";
import EMBED_CSS from "./embed-styles.generated.css";

// Build-time injected constant
declare const __WATCHMAP_API_BASE__: string;
const API_BASE: string =
  typeof __WATCHMAP_API_BASE__ !== "undefined" ? __WATCHMAP_API_BASE__ : "";

export class WatchMapPlayerElement extends HTMLElement {
  public static get observedAttributes(): string[] {
    return ["video-id"];
  }

  private _root: Root | null = null;
  private _mountContainer: HTMLDivElement | null = null;
  private _shadowRoot: ShadowRoot | null = null;

  constructor() {
    super();
  }

  public connectedCallback(): void {
    if (!this._shadowRoot) {
      this._shadowRoot = this.attachShadow({ mode: "open" });

      // Inject full isolated stylesheet into Shadow DOM
      const styleEl = document.createElement("style");
      styleEl.textContent = String(EMBED_CSS);
      this._shadowRoot.appendChild(styleEl);

      // Create React mount container
      this._mountContainer = document.createElement("div");
      this._mountContainer.className = "watchmap-embed-root";
      this._shadowRoot.appendChild(this._mountContainer);
    }

    this.render();
  }

  public disconnectedCallback(): void {
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
  }

  public attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (oldValue !== newValue && this._shadowRoot) {
      this.render();
    }
  }

  private render(): void {
    if (!this._mountContainer) return;

    const videoId = this.getAttribute("video-id") || "";

    if (!this._root) {
      this._root = createRoot(this._mountContainer);
    }

    this._root.render(
      <EmbedPlayer videoId={videoId} apiBase={API_BASE} />
    );
  }
}

if (typeof window !== "undefined" && !customElements.get("watchmap-player")) {
  customElements.define("watchmap-player", WatchMapPlayerElement);
}
