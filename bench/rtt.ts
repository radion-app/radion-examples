/**
 * Raw-WebSocket transport probe.
 *
 * The SDK deliberately hides the socket and its `ping()`, so pure transport
 * latency is measured here against a second, bare connection. It reports:
 *   - handshake timings: socket open, first `subscribed` ack, first `event`;
 *   - round-trip time: sequential `{action:"ping"}` → `{type:"pong"}`.
 *
 * Pings are sent one at a time (the `pong` frame carries no correlation id), so
 * a late pong naturally stalls the loop — HDR's coordinated-omission correction
 * then back-fills the tail when it finally arrives.
 */
import { WebSocket } from "ws";

import { LatencyRecorder } from "./histogram";
import type { LatencySummary } from "./histogram";

/** One-shot connection-establishment timings, in milliseconds. */
export interface HandshakeTimings {
  openMs: number;
  firstAckMs: number | null;
  firstEventMs: number | null;
}

export interface RttResult {
  handshake: HandshakeTimings;
  rtt: LatencySummary;
}

interface RttProbeOptions {
  wsUrl: string;
  apiKey: string;
  pingIntervalMs: number;
  /** Channel subscribed purely to trigger inbound events for handshake timing. */
  channel?: string;
}

export class RttProbe {
  private readonly options: RttProbeOptions;
  private readonly rtt: LatencyRecorder;
  private socket: WebSocket | undefined;
  private recording = false;

  private readonly handshake: HandshakeTimings = {
    firstAckMs: null,
    firstEventMs: null,
    openMs: 0,
  };
  private subscribeSentAt = 0;
  private pingSentAt = 0;
  private pingTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;

  constructor(options: RttProbeOptions) {
    this.options = options;
    this.rtt = new LatencyRecorder({
      expectedIntervalMs: options.pingIntervalMs,
    });
  }

  /** Open the socket and subscribe. Resolves on open, rejects if it never opens. */
  async start(): Promise<boolean> {
    const { promise, resolve, reject } = Promise.withResolvers<boolean>();
    const startedAt = performance.now();
    const socket = new WebSocket(this.options.wsUrl, {
      headers: { "X-API-Key": this.options.apiKey },
    });
    this.socket = socket;

    socket.on("open", () => {
      this.handshake.openMs = performance.now() - startedAt;
      this.subscribeSentAt = performance.now();
      socket.send(
        JSON.stringify({
          action: "subscribe",
          channel: this.options.channel ?? "trading",
          id: "rtt",
        })
      );
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

    return await promise;
  }

  /** Start counting RTT samples (called once the warmup window has elapsed). */
  beginRecording(): void {
    this.recording = true;
  }

  /** Close the socket and return handshake + RTT results. */
  stop(): RttResult {
    this.stopped = true;
    if (this.pingTimer !== undefined) {
      clearTimeout(this.pingTimer);
    }
    this.socket?.close();
    return { handshake: this.handshake, rtt: this.rtt.summary() };
  }

  private onFrame(data: Buffer): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
      return;
    }
    const { type } = parsed;
    if (type === "subscribed") {
      this.handshake.firstAckMs ??= performance.now() - this.subscribeSentAt;
    } else if (type === "event") {
      this.handshake.firstEventMs ??= performance.now() - this.subscribeSentAt;
    } else if (type === "pong") {
      this.onPong();
    }
  }

  private onPong(): void {
    if (this.recording) {
      this.rtt.record(performance.now() - this.pingSentAt);
    }
    // Space the next ping so the cadence stays ~pingIntervalMs end to end.
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
      this.socket.send(JSON.stringify({ action: "ping" }));
    }, delayMs);
  }
}
