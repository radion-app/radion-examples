import { describe, expect, it } from "vitest";

import type { LatencySummary } from "./histogram";
import type { ProbeResult } from "./probe";
import { buildReport, detectSkew, formatReport } from "./report";

const summary = (over: Partial<LatencySummary> = {}): LatencySummary => ({
  count: 10,
  maxMs: 20,
  meanMs: 5,
  minMs: 1,
  p50Ms: 4,
  p90Ms: 10,
  p95Ms: 12,
  p999Ms: 20,
  p99Ms: 18,
  stdDevMs: 2,
  ...over,
});

const probe = (skewOver: Partial<ProbeResult["skew"]> = {}): ProbeResult => ({
  handshake: { firstAckMs: 12, firstEventMs: 40, openMs: 30 },
  oneway: summary({ count: 500 }),
  reliability: { disconnects: 0, laggedEvents: 0, skippedEvents: 0 },
  rtt: summary(),
  skew: { minRawMs: 3, negativeSamples: 0, ...skewOver },
  throughput: {
    confirmedEvents: 480,
    confirmedPerSec: 4.8,
    pendingEvents: 500,
    pendingPerSec: 5,
    windowSec: 100,
  },
});

const config = {
  durationSec: 100,
  pingIntervalMs: 1000,
  warmupSec: 5,
  wsUrl: "wss://api.radion.app/ws",
};

const startedAt = "2026-07-10T00:00:00.000Z";

describe("detectSkew", () => {
  it("flags any negative sample", () => {
    expect(detectSkew({ minRawMs: -2, negativeSamples: 1 })).toBe(true);
    expect(detectSkew({ minRawMs: -1, negativeSamples: 0 })).toBe(true);
  });

  it("passes clean deltas", () => {
    expect(detectSkew({ minRawMs: 3, negativeSamples: 0 })).toBe(false);
    expect(detectSkew({ minRawMs: null, negativeSamples: 0 })).toBe(false);
  });
});

describe("buildReport", () => {
  it("folds the probe result and marks no skew for clean deltas", () => {
    const report = buildReport({ config, probe: probe(), startedAt });
    expect(report.clockSkewWarning).toBe(false);
    expect(report.rtt.count).toBe(10);
    expect(report.oneway.count).toBe(500);
    expect(report.handshake.firstAckMs).toBe(12);
  });

  it("marks skew when a negative delta was seen", () => {
    const report = buildReport({
      config,
      probe: probe({ minRawMs: -7, negativeSamples: 4 }),
      startedAt,
    });
    expect(report.clockSkewWarning).toBe(true);
  });
});

describe("formatReport", () => {
  it("renders every section with numbers", () => {
    const out = formatReport(
      buildReport({ config, probe: probe(), startedAt })
    );
    expect(out).toContain("RTT");
    expect(out).toContain("one-way");
    expect(out).toContain("Handshake");
    expect(out).toContain("Throughput");
    expect(out).toContain("Reliability");
    expect(out).toContain("skipped=");
    expect(out).not.toContain("clock skew");
  });

  it("shows n/a for a missing first-ack and warns on skew", () => {
    const base = probe({ minRawMs: -3, negativeSamples: 2 });
    const withNullAck: ProbeResult = {
      ...base,
      handshake: { firstAckMs: null, firstEventMs: null, openMs: 30 },
    };
    const out = formatReport(
      buildReport({ config, probe: withNullAck, startedAt })
    );
    expect(out).toContain("first-ack=n/a");
    expect(out).toContain("clock skew");
  });
});
