/**
 * Single-connection benchmark probe.
 *
 * The Free plan allows one WebSocket connection with two subscriptions, so the
 * whole benchmark rides one raw `ws` connection and measures everything off it:
 *   - handshake timings: socket open, first `subscribed` ack, first `event`;
 *   - transport RTT: sequential `{action:"ping"}` → `{type:"pong"}`;
 *   - one-way delivery: `mempool.trading` `seen_at_ms` → local receipt (the one
 *     feed carrying a server clock; confirmed `trading` has no timestamp);
 *   - throughput: pending + confirmed events/sec;
 *   - reliability: `lagged` error frames (with their `skipped` count) and any
 *     unexpected disconnects during the window.
 *
 * Using the raw socket rather than the SDK keeps the measurement free of client
 * buffering and exposes the `skipped` field the SDK omits. One-way latency needs
 * a synced clock; the raw delta (including negatives) is tracked to flag skew.
 */
import { mempoolPayloadSchema } from "@radion-app/sdk";
import { WebSocket } from "ws";

import { LatencyRecorder } from "./histogram";
import type { LatencySummary } from "./histogram";

const PENDING_ID = "pending";
const CONFIRMED_ID = "confirmed";

/** One-shot connection-establishment timings, in milliseconds. */
export interface HandshakeTimings {
  openMs: number;
  firstAckMs: number | null;
  firstEventMs: number | null;
}

export interface ThroughputResult {
  pendingEvents: number;
  confirmedEvents: number;
  pendingPerSec: number;
  confirmedPerSec: number;
  windowSec: number;
}

export interface ReliabilityResult {
  laggedEvents: number;
  skippedEvents: number;
  disconnects: number;
}

/** Clock-skew evidence gathered from the raw one-way deltas. */
export interface SkewResult {
  negativeSamples: number;
  minRawMs: number | null;
}

export interface ProbeResult {
  handshake: HandshakeTimings;
  rtt: LatencySummary;
  oneway: LatencySummary;
  throughput: ThroughputResult;
  reliability: ReliabilityResult;
  skew: SkewResult;
}

interface ProbeOptions {
  wsUrl: string;
  apiKey: string;
  pingIntervalMs: number;
}

export class BenchProbe {
  private readonly options: ProbeOptions;
  private readonly rttRecorder: LatencyRecorder;
  private readonly onewayRecorder = new LatencyRecorder();
  private socket: WebSocket | undefined;
  private recording = false;
  private stopped = false;

  private readonly handshake: HandshakeTimings = {
    firstAckMs: null,
    firstEventMs: null,
    openMs: 0,
  };
  private subscribeSentAt = 0;
  private pingSentAt = 0;
  private pingTimer: ReturnType<typeof setTimeout> | undefined;

  private windowStart = 0;
  private pendingEvents = 0;
  private confirmedEvents = 0;
  private laggedEvents = 0;
  private skippedEvents = 0;
  private disconnects = 0;
  private negativeSamples = 0;
  private minRawMs: number | null = null;

  constructor(options: ProbeOptions) {
    this.options = options;
    this.rttRecorder = new LatencyRecorder({
      expectedIntervalMs: options.pingIntervalMs,
    });
  }

  /** Open the connection and subscribe. Resolves on open, rejects if it fails. */
  async start(): Promise<boolean> {
    const { promise, resolve, reject } = Promise.withResolvers<boolean>();
    const startedAt = performance.now();
    const socket = new WebSocket(this.options.wsUrl, {
      headers: { "X-API-Key": this.options.apiKey },
    });
    this.socket = socket;

    socket.on("open", () => {
      this.handshake.openMs = performance.now() - startedAt;
      this.subscribe();
      this.scheduleNextPing(0);
      resolve(true);
    });
    socket.on("message", (data: Buffer) => {
      this.onFrame(data);
    });
    socket.on("error", (error: Error) => {
      if (this.handshake.openMs === 0) {
        reject(error);
      }
    });
    socket.on("close", () => {
      if (this.recording && !this.stopped) {
        this.disconnects += 1;
      }
    });

    return await promise;
  }

  /** Begin the measured window: reset counters and start the throughput clock. */
  beginRecording(): void {
    this.pendingEvents = 0;
    this.confirmedEvents = 0;
    this.laggedEvents = 0;
    this.skippedEvents = 0;
    this.disconnects = 0;
    this.negativeSamples = 0;
    this.minRawMs = null;
    this.windowStart = performance.now();
    this.recording = true;
  }

  /** Close the connection and return the measured results. */
  stop(): ProbeResult {
    this.stopped = true;
    this.recording = false;
    if (this.pingTimer !== undefined) {
      clearTimeout(this.pingTimer);
    }
    this.socket?.close();

    const windowSec = Math.max(
      (performance.now() - this.windowStart) / 1000,
      0
    );
    const perSec = (n: number): number => (windowSec > 0 ? n / windowSec : 0);

    return {
      handshake: this.handshake,
      oneway: this.onewayRecorder.summary(),
      reliability: {
        disconnects: this.disconnects,
        laggedEvents: this.laggedEvents,
        skippedEvents: this.skippedEvents,
      },
      rtt: this.rttRecorder.summary(),
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

  private subscribe(): void {
    this.subscribeSentAt = performance.now();
    this.send({
      action: "subscribe",
      channel: "trading",
      confirmed: false,
      id: PENDING_ID,
    });
    this.send({
      action: "subscribe",
      channel: "trading",
      confirmed: true,
      id: CONFIRMED_ID,
    });
  }

  private onFrame(data: Buffer): void {
    let value: unknown;
    try {
      value = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (typeof value !== "object" || value === null || !("type" in value)) {
      return;
    }
    const { type } = value;
    if (type === "subscribed") {
      this.handshake.firstAckMs ??= performance.now() - this.subscribeSentAt;
    } else if (type === "event") {
      this.handshake.firstEventMs ??= performance.now() - this.subscribeSentAt;
      this.onEvent(value);
    } else if (type === "pong") {
      this.onPong();
    } else if (type === "error") {
      this.onError(value);
    }
  }

  private onEvent(value: object): void {
    if (!this.recording) {
      return;
    }
    const confirmed = "confirmed" in value ? value.confirmed : undefined;
    if (confirmed === false) {
      this.pendingEvents += 1;
      this.recordOneway("data" in value ? value.data : undefined);
    } else {
      this.confirmedEvents += 1;
    }
  }

  private recordOneway(data: unknown): void {
    const parsed = mempoolPayloadSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    const rawMs = Date.now() - parsed.data.seen_at_ms;
    if (this.minRawMs === null || rawMs < this.minRawMs) {
      this.minRawMs = rawMs;
    }
    if (rawMs < 0) {
      this.negativeSamples += 1;
    }
    this.onewayRecorder.record(rawMs);
  }

  private onError(value: object): void {
    const code = "code" in value ? value.code : undefined;
    if (code !== "lagged" || !this.recording) {
      return;
    }
    this.laggedEvents += 1;
    const skipped = "skipped" in value ? value.skipped : undefined;
    this.skippedEvents += typeof skipped === "number" ? skipped : 0;
  }

  private onPong(): void {
    if (this.recording) {
      this.rttRecorder.record(performance.now() - this.pingSentAt);
    }
    const elapsed = performance.now() - this.pingSentAt;
    this.scheduleNextPing(Math.max(0, this.options.pingIntervalMs - elapsed));
  }

  private scheduleNextPing(delayMs: number): void {
    if (this.stopped) {
      return;
    }
    this.pingTimer = setTimeout(() => {
      if (this.stopped || this.socket?.readyState !== WebSocket.OPEN) {
        return;
      }
      this.pingSentAt = performance.now();
      this.send({ action: "ping" });
    }, delayMs);
  }

  private send(frame: Record<string, unknown>): void {
    this.socket?.send(JSON.stringify(frame));
  }
}
