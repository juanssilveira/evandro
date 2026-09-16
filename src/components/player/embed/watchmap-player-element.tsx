import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EmbedPlayer } from "./embed-player";
import EMBED_CSS from "./embed-styles.generated.css";

function getScriptOrigin(): string {
  if (typeof document === "undefined") return "";
  const currentScript = document.currentScript as HTMLScriptElement | null;
  if (currentScript?.src) {
    try {
      const url = new URL(currentScript.src);
      return url.origin;
    } catch {
      // fallback
    }
  }
  const scripts = document.querySelectorAll<HTMLScriptElement>("script[src*='watchmap-player']");
  if (scripts.length > 0) {
    try {
      const lastScript = scripts[scripts.length - 1];
      const url = new URL(lastScript.src, window.location.href);
      return url.origin;
    } catch {
      // fallback
    }
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}

export class WatchMapPlayerElement extends HTMLElement {
  public static get observedAttributes(): string[] {
    return ["video-id", "api-base"];
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
    const apiBase = this.getAttribute("api-base") || getScriptOrigin();

    if (!this._root) {
      this._root = createRoot(this._mountContainer);
    }

    this._root.render(
      <EmbedPlayer videoId={videoId} apiBase={apiBase} />
    );
  }
}

if (typeof window !== "undefined" && !customElements.get("watchmap-player")) {
  customElements.define("watchmap-player", WatchMapPlayerElement);
}
