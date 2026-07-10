import { describe, expect, it } from "vitest";

import { LatencyRecorder } from "./histogram";

describe("LatencyRecorder", () => {
  it("returns an all-zero summary when empty", () => {
    expect(new LatencyRecorder().summary()).toEqual({
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
    });
  });

  it("computes percentiles over a known 1..100ms dataset", () => {
    const rec = new LatencyRecorder();
    for (let v = 1; v <= 100; v += 1) {
      rec.record(v);
    }
    const s = rec.summary();
    expect(s.count).toBe(100);
    expect(s.minMs).toBeCloseTo(1, 1);
    expect(s.maxMs).toBeCloseTo(100, 1);
    // HDR percentile picks the value at/just-above the rank; allow ±1ms slack.
    expect(s.p50Ms).toBeGreaterThanOrEqual(49);
    expect(s.p50Ms).toBeLessThanOrEqual(51);
    expect(s.p99Ms).toBeGreaterThanOrEqual(98);
    expect(s.p99Ms).toBeLessThanOrEqual(100);
  });

  it("preserves sub-millisecond resolution", () => {
    const rec = new LatencyRecorder();
    for (let i = 0; i < 100; i += 1) {
      rec.record(0.25);
    }
    expect(rec.summary().p50Ms).toBeCloseTo(0.25, 2);
  });

  it("ignores negative and non-finite samples", () => {
    const rec = new LatencyRecorder();
    rec.record(-5);
    rec.record(Number.NaN);
    rec.record(Number.POSITIVE_INFINITY);
    expect(rec.count).toBe(0);
    rec.record(10);
    expect(rec.count).toBe(1);
  });

  it("synthesises coordinated-omission fills for a long stall", () => {
    // One 1000ms sample with a 100ms expected cadence should back-fill ~9
    // extra samples at 900,800,… so the tail is not understated.
    const rec = new LatencyRecorder({ expectedIntervalMs: 100 });
    rec.record(1000);
    expect(rec.count).toBeGreaterThan(1);
    expect(rec.summary().maxMs).toBeCloseTo(1000, 0);
  });
});
