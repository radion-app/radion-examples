/**
 * Result assembly, formatting and persistence.
 *
 * `buildReport` folds the probe result into one plain object and derives the
 * clock-skew verdict. `formatReport` renders the console tables. `writeReport`
 * persists the JSON. Formatting and skew detection are kept pure so they can be
 * unit-tested without a socket or a clock.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { LatencySummary } from "./histogram";
import type {
  HandshakeTimings,
  ProbeResult,
  ReliabilityResult,
  SkewResult,
  ThroughputResult,
} from "./probe";

export interface BenchReport {
  startedAt: string;
  config: {
    wsUrl: string;
    durationSec: number;
    warmupSec: number;
    pingIntervalMs: number;
  };
  handshake: HandshakeTimings;
  rtt: LatencySummary;
  oneway: LatencySummary;
  throughput: ThroughputResult;
  reliability: ReliabilityResult;
  skew: SkewResult;
  clockSkewWarning: boolean;
}

/**
 * A negative one-way delta is physically impossible — receipt cannot precede
 * the server stamp — so any negative sample means the local clock is skewed and
 * the one-way numbers are untrustworthy.
 */
export const detectSkew = (skew: SkewResult): boolean =>
  skew.negativeSamples > 0 || (skew.minRawMs !== null && skew.minRawMs < 0);

interface BuildReportParams {
  startedAt: string;
  config: BenchReport["config"];
  probe: ProbeResult;
}

export const buildReport = (params: BuildReportParams): BenchReport => ({
  clockSkewWarning: detectSkew(params.probe.skew),
  config: params.config,
  handshake: params.probe.handshake,
  oneway: params.probe.oneway,
  reliability: params.probe.reliability,
  rtt: params.probe.rtt,
  skew: params.probe.skew,
  startedAt: params.startedAt,
  throughput: params.probe.throughput,
});

const ms = (n: number): string => `${n.toFixed(2)}ms`;
const msOrNa = (n: number | null): string => (n === null ? "n/a" : ms(n));
const perSec = (n: number): string => `${n.toFixed(1)}/s`;

const percentileRow = (label: string, s: LatencySummary): string =>
  `  ${label.padEnd(10)} count=${String(s.count).padStart(7)}  ` +
  `p50=${ms(s.p50Ms)}  p90=${ms(s.p90Ms)}  p95=${ms(s.p95Ms)}  ` +
  `p99=${ms(s.p99Ms)}  p99.9=${ms(s.p999Ms)}  max=${ms(s.maxMs)}`;

/** Render a human-readable multi-section summary for the console. */
export const formatReport = (r: BenchReport): string => {
  const skewLines = r.clockSkewWarning
    ? [
        "",
        `  ⚠ clock skew: ${r.skew.negativeSamples} one-way sample(s) < 0 ` +
          `(min ${msOrNa(r.skew.minRawMs)}). Sync the clock (chrony/NTP); ` +
          "one-way numbers are unreliable. RTT is skew-immune.",
      ]
    : [];
  const lines = [
    "── Radion WebSocket benchmark ──────────────────────────────",
    `  ${r.config.wsUrl}   ${r.config.durationSec}s window (${r.config.warmupSec}s warmup)`,
    "",
    "Latency (percentiles)",
    percentileRow("RTT", r.rtt),
    percentileRow("one-way", r.oneway),
    `  RTT jitter (stddev) ${ms(r.rtt.stdDevMs)}   RTT min ${ms(r.rtt.minMs)}`,
    "",
    "Handshake",
    `  open=${ms(r.handshake.openMs)}  first-ack=${msOrNa(r.handshake.firstAckMs)}  first-event=${msOrNa(r.handshake.firstEventMs)}`,
    "",
    "Throughput",
    `  pending ${perSec(r.throughput.pendingPerSec)} (${r.throughput.pendingEvents})  confirmed ${perSec(r.throughput.confirmedPerSec)} (${r.throughput.confirmedEvents})  over ${r.throughput.windowSec.toFixed(1)}s`,
    "",
    "Reliability",
    `  lagged=${r.reliability.laggedEvents}  skipped=${r.reliability.skippedEvents}  disconnects=${r.reliability.disconnects}`,
    ...skewLines,
    "────────────────────────────────────────────────────────────",
  ];
  return lines.join("\n");
};

/** Write the report as JSON under `outDir`; returns the file path. */
export const writeReport = (report: BenchReport, outDir: string): string => {
  mkdirSync(outDir, { recursive: true });
  const stamp = report.startedAt.replaceAll(/[:.]/gu, "-");
  const file = path.join(outDir, `${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
};
