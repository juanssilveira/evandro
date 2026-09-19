import type { TrackerAccumulator } from "./tracker-accumulator";

export interface TrackerTransportOptions {
  videoId: string;
  apiBase?: string;
  debug?: boolean;
}

export class TrackerTransport {
  private readonly videoId: string;
  private readonly apiBase: string;
  private readonly debug: boolean;

  private sequence: number = 0;
  private isDestroyed: boolean = false;
  private isFlushing: boolean = false;
  private hasPendingFlush: boolean = false;

  private initialFlushTimer: NodeJS.Timeout | null = null;
  private periodicFlushTimer: NodeJS.Timeout | null = null;

  constructor(options: TrackerTransportOptions) {
    this.videoId = options.videoId;
    this.apiBase = (options.apiBase || "").replace(/\/$/, "");
    this.debug = Boolean(options.debug);
  }

  public startTimers(
    accumulator: TrackerAccumulator,
    onFlushLogged?: (seq: number, payload: unknown) => void
  ): void {
    if (this.isDestroyed) return;

    // Schedule initial View flush at ~2.5s (outside critical startup path)
    this.initialFlushTimer = setTimeout(() => {
      this.initialFlushTimer = null;
      if (!this.isDestroyed) {
        this.flush(accumulator, false, onFlushLogged);
      }
    }, 2500);

    // Schedule periodic flush every ~15s if dirty
    this.periodicFlushTimer = setInterval(() => {
      if (!this.isDestroyed && accumulator.getIsDirty()) {
        this.flush(accumulator, false, onFlushLogged);
      }
    }, 15000);
  }

  public flush(
    accumulator: TrackerAccumulator,
    keepalive: boolean = false,
    onFlushLogged?: (seq: number, payload: unknown) => void
  ): void {
    if (this.isDestroyed && !keepalive) return;

    if (this.isFlushing) {
      this.hasPendingFlush = true;
      return;
    }

    this.sequence++;
    const currentSeq = this.sequence;
    const payload = accumulator.getSnapshot(currentSeq);
    accumulator.clearDirty();

    if (this.debug) {
      console.log(
        `[Evandro Tracker] FLUSH sequence=${currentSeq} watchTime=${payload.watchTimeMs}ms ranges=${payload.watchedRanges.length} unique=${payload.uniqueWatchedSeconds}s`,
        payload
      );
    }
    onFlushLogged?.(currentSeq, payload);

    const url = `${this.apiBase}/api/embed/videos/${encodeURIComponent(this.videoId)}/telemetry`;
    const bodyStr = JSON.stringify(payload);

    this.isFlushing = true;

    try {
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: bodyStr,
        keepalive,
      })
        .then(() => {
          this.isFlushing = false;
          if (this.hasPendingFlush && !this.isDestroyed) {
            this.hasPendingFlush = false;
            this.flush(accumulator, false, onFlushLogged);
          }
        })
        .catch((err) => {
          this.isFlushing = false;
          if (this.debug) {
            console.warn("[Evandro Tracker] Telemetry send failed:", err);
          }
          if (this.hasPendingFlush && !this.isDestroyed) {
            this.hasPendingFlush = false;
            this.flush(accumulator, false, onFlushLogged);
          }
        });
    } catch (err) {
      this.isFlushing = false;
      if (this.debug) {
        console.warn("[Evandro Tracker] Telemetry send exception:", err);
      }
    }
  }

  public destroy(accumulator: TrackerAccumulator): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.initialFlushTimer) {
      clearTimeout(this.initialFlushTimer);
      this.initialFlushTimer = null;
    }
    if (this.periodicFlushTimer) {
      clearInterval(this.periodicFlushTimer);
      this.periodicFlushTimer = null;
    }

    // Final best-effort flush with keepalive
    this.flush(accumulator, true);
  }
}
