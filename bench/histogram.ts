/**
 * Thin wrapper over hdr-histogram-js for latency samples.
 *
 * Samples are supplied in milliseconds but stored as integer microseconds so
 * sub-millisecond resolution survives HDR's integer buckets. Percentiles are
 * reported back in milliseconds. For fixed-cadence probes (RTT pings) pass
 * `expectedIntervalMs` to enable HDR's coordinated-omission correction, so a
 * stalled connection doesn't hide its own tail latency.
 */
import { build } from "hdr-histogram-js";
import type { Histogram } from "hdr-histogram-js";

const US_PER_MS = 1000;

/** Percentile summary of recorded latencies, all fields in milliseconds. */
export interface LatencySummary {
  count: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  stdDevMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  p999Ms: number;
}

const ZERO_SUMMARY: LatencySummary = {
  count: 0,
  maxMs: 0,
  meanMs: 0,
  minMs: 0,
  p50Ms: 0,
  p90Ms: 0,
  p95Ms: 0,
  p999Ms: 0,
  p99Ms: 0,
  stdDevMs: 0,
};

export class LatencyRecorder {
  private readonly hist: Histogram;
  private readonly expectedIntervalUs: number | undefined;

  constructor(options: { expectedIntervalMs?: number } = {}) {
    // Pure-JS histogram (no async WASM init); 3 significant digits by default.
    this.hist = build({ useWebAssembly: false });
    this.expectedIntervalUs =
      options.expectedIntervalMs === undefined
        ? undefined
        : Math.round(options.expectedIntervalMs * US_PER_MS);
  }

  /**
   * Record one latency sample, in milliseconds. Non-finite or negative values
   * (e.g. a clock-skewed one-way delta) are ignored — skew is detected upstream
   * where the raw delta is still visible.
   */
  record(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      return;
    }
    const us = Math.round(ms * US_PER_MS);
    if (this.expectedIntervalUs === undefined) {
      this.hist.recordValue(us);
    } else {
      this.hist.recordValueWithExpectedInterval(us, this.expectedIntervalUs);
    }
  }

  /** Number of samples recorded (including synthetic coordinated-omission fills). */
  get count(): number {
    return this.hist.totalCount;
  }

  /** Percentile summary in milliseconds; all-zero when nothing was recorded. */
  summary(): LatencySummary {
    const h = this.hist;
    if (h.totalCount === 0) {
      return { ...ZERO_SUMMARY };
    }
    const ms = (us: number): number => us / US_PER_MS;
    const min = Number.isFinite(h.minNonZeroValue) ? h.minNonZeroValue : 0;
    return {
      count: h.totalCount,
      maxMs: ms(h.maxValue),
      meanMs: ms(h.mean),
      minMs: ms(min),
      p50Ms: ms(h.getValueAtPercentile(50)),
      p90Ms: ms(h.getValueAtPercentile(90)),
      p95Ms: ms(h.getValueAtPercentile(95)),
      p999Ms: ms(h.getValueAtPercentile(99.9)),
      p99Ms: ms(h.getValueAtPercentile(99)),
      stdDevMs: ms(h.stdDeviation),
    };
  }
}
