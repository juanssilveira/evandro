import type { PlayerConfig } from "./player-config";

/**
 * Canonical data contract for the public embed bootstrap endpoint (GET /api/embed/videos/[publicId]).
 * Lightweight TypeScript contract shared across Loader, Core, and Server without bundle inflation.
 */
export interface EmbedBootstrapPayload {
  videoId: string;
  title: string;
  duration: number | null;
  playbackUrl: string;
  playback: {
    type: "hls";
    url: string;
  };
  posterUrl: string | null;
  backgroundPreviewUrl: string | null;
  config: PlayerConfig;
}

/**
 * Server-side resolution result for the embed bootstrap pipeline.
 */
export interface EmbedBootstrapResolution {
  authorized: boolean;
  statusCode: number;
  error?: string;
  data?: EmbedBootstrapPayload;
  metrics: {
    dbDurationMs: number;
    accessDurationMs: number;
    payloadDurationMs: number;
    totalDurationMs: number;
  };
}
