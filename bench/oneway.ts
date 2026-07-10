/**
 * SDK-path delivery probe.
 *
 * Uses the real `@radion-app/sdk` client — the same code path an app runs — to
 * measure what actually reaches a consumer:
 *   - one-way delivery latency, from the server's `seen_at_ms` stamp on the
 *     `mempool.trading` (pending) feed to local receipt. This is the only feed
 *     carrying a clean server clock; the confirmed `trading` payload has no
 *     timestamp, so it contributes throughput and reliability only;
 *   - throughput, per feed (events/sec over the measured window);
 *   - reliability, off the SDK lifecycle: `lagged` errors and reconnects.
 *
 * One-way latency depends on a synced clock. The raw delta (including negatives)
 * is tracked so a skewed clock can be flagged rather than silently trusted.
 */
import {
  mempoolPayloadSchema,
  Radion,
  RadionServerError,
} from "@radion-app/sdk";

import { LatencyRecorder } from "./histogram";
import type { LatencySummary } from "./histogram";

const FATAL_CODES = new Set(["key_revoked", "revalidation_failed"]);

export interface ThroughputResult {
  pendingEvents: number;
  confirmedEvents: number;
  pendingPerSec: number;
  confirmedPerSec: number;
  windowSec: number;
}

export interface ReliabilityResult {
  laggedEvents: number;
  reconnects: number;
}

/** Clock-skew evidence gathered from the raw one-way deltas. */
export interface SkewResult {
  negativeSamples: number;
  minRawMs: number | null;
}

export interface OnewayResult {
  oneway: LatencySummary;
  throughput: ThroughputResult;
  reliability: ReliabilityResult;
  skew: SkewResult;
}

interface OnewayProbeOptions {
  apiKey: string;
  wsUrl: string;
  /** Called when the server reports a fatal, non-recoverable condition. */
  onFatal?: (code: string) => void;
}

export class OnewayProbe {
  private readonly options: OnewayProbeOptions;
  private readonly radion: Radion;
  private readonly latency = new LatencyRecorder();

  private recording = false;
  private windowStart = 0;
  private windowEnd = 0;

  private pendingEvents = 0;
  private confirmedEvents = 0;
  private laggedEvents = 0;
  private reconnects = 0;
  private negativeSamples = 0;
  private minRawMs: number | null = null;

  constructor(options: OnewayProbeOptions) {
    this.options = options;
    this.radion = new Radion({ apiKey: options.apiKey, wsUrl: options.wsUrl });
    this.wire();
  }

  /** Connect and subscribe to the pending + confirmed trading feeds. */
  async start(): Promise<void> {
    const { realtime } = this.radion;
    realtime.subscribe({ channel: "trading", confirmed: false, id: "pending" });
    realtime.subscribe({
      channel: "trading",
      confirmed: true,
      id: "confirmed",
    });
    await realtime.connect();
  }

  /** Begin the measured window: reset counters and start the throughput clock. */
  beginRecording(): void {
    this.pendingEvents = 0;
    this.confirmedEvents = 0;
    this.laggedEvents = 0;
    this.reconnects = 0;
    this.negativeSamples = 0;
    this.minRawMs = null;
    this.windowStart = performance.now();
    this.recording = true;
  }

  /** Close the connection and return the measured results. */
  stop(): OnewayResult {
    this.recording = false;
    this.windowEnd = performance.now();
    this.radion.realtime.close();

    const windowSec = Math.max((this.windowEnd - this.windowStart) / 1000, 0);
    const perSec = (n: number): number => (windowSec > 0 ? n / windowSec : 0);

    return {
      oneway: this.latency.summary(),
      reliability: {
        laggedEvents: this.laggedEvents,
        reconnects: this.reconnects,
      },
      skew: { minRawMs: this.minRawMs, negativeSamples: this.negativeSamples },
      throughput: {
        confirmedEvents: this.confirmedEvents,
        confirmedPerSec: perSec(this.confirmedEvents),
        pendingEvents: this.pendingEvents,
        pendingPerSec: perSec(this.pendingEvents),
        windowSec,
      },
    };
  }

  private wire(): void {
    const { realtime } = this.radion;

    realtime.onChannel("trading", (event) => {
      if (event.confirmed === false) {
        this.onPending(event.data);
      } else if (this.recording) {
        this.confirmedEvents += 1;
      }
    });

    realtime.onLifecycle("reconnect", () => {
      if (this.recording) {
        this.reconnects += 1;
      }
    });

    realtime.onLifecycle("error", (frame: Error) => {
      const code = frame instanceof RadionServerError ? frame.code : undefined;
      if (code === "lagged" && this.recording) {
        this.laggedEvents += 1;
        return;
      }
      if (code !== undefined && FATAL_CODES.has(code)) {
        this.options.onFatal?.(code);
      }
    });
  }

  private onPending(data: unknown): void {
    const parsed = mempoolPayloadSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    if (!this.recording) {
      return;
    }
    this.pendingEvents += 1;

    const rawMs = Date.now() - parsed.data.seen_at_ms;
    if (this.minRawMs === null || rawMs < this.minRawMs) {
      this.minRawMs = rawMs;
    }
    if (rawMs < 0) {
      this.negativeSamples += 1;
    }
    this.latency.record(rawMs);
  }
}
