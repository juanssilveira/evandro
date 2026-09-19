/**
 * Evandro Player Headless Engine Entry Point
 * Bundled as standalone `player-engine-[hash].js` chunk (ESM, zero React).
 */

import { PlayerEngine, findMaxLevelForHeight } from "./player-engine";
import type { PlayerEngineOptions } from "./types";

export * from "./types";
export { PlayerEngine, findMaxLevelForHeight };

export interface EvandroPlayerEngineModule {
  create: (options: PlayerEngineOptions) => PlayerEngine;
  PlayerEngine: typeof PlayerEngine;
  ready: boolean;
}

interface WindowWithEngine extends Window {
  __EVANDRO_PLAYER_ENGINE__?: EvandroPlayerEngineModule;
}

export function createPlayerEngine(options: PlayerEngineOptions): PlayerEngine {
  return new PlayerEngine(options);
}

// Global registry for loader / core coordination
if (typeof window !== "undefined") {
  const win = window as WindowWithEngine;
  win.__EVANDRO_PLAYER_ENGINE__ = {
    create: createPlayerEngine,
    PlayerEngine,
    ready: true,
  };

  window.dispatchEvent(new CustomEvent("evandro-player:engine-loaded"));
}
