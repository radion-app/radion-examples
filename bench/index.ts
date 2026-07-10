/**
 * Radion WebSocket latency benchmark.
 *
 * One raw WebSocket connection (Free-plan friendly: 1 connection, 2
 * subscriptions) measures handshake timings, transport RTT, one-way delivery,
 * throughput and reliability over a single window.
 *
 * Prints a percentile summary and writes a JSON report. A warmup window is
 * discarded before measurement; Ctrl-C stops early and still reports.
 *
 * Run:
 *   pnpm bench                                  # 300s default
 *   pnpm bench --duration 60 --warmup 5         # short run
 *   pnpm bench --ping-interval 500 --out ./out  # tune cadence / output dir
 */
import { resolveConfig } from "./config";
import { BenchProbe } from "./probe";
import { buildReport, formatReport, writeReport } from "./report";

/** A sleep that can be cut short (Ctrl-C, fatal error) to end a phase early. */
class InterruptibleWait {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private resolveFn: (() => void) | undefined;

  async wait(ms: number): Promise<boolean> {
    const { promise, resolve } = Promise.withResolvers<boolean>();
    this.resolveFn = () => {
      resolve(true);
    };
    this.timer = setTimeout(() => {
      this.finish();
    }, ms);
    return await promise;
  }

  interrupt(): void {
    this.finish();
  }

  private finish(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.resolveFn?.();
    this.resolveFn = undefined;
  }
}

const CONNECT_TIMEOUT_MS = 15_000;

/** A promise that never resolves, only rejects once `ms` elapses. */
const rejectAfter = async (ms: number, label: string): Promise<never> => {
  const { promise, reject } = Promise.withResolvers<never>();
  const timer = setTimeout(() => {
    reject(new Error(`${label} timed out after ${ms}ms`));
  }, ms);
  timer.unref();
  return await promise;
};

const main = async (): Promise<void> => {
  const cfg = resolveConfig(process.argv.slice(2), process.env);

  let aborting = false;
  const waiter = new InterruptibleWait();
  const abort = (reason: string): void => {
    if (aborting) {
      return;
    }
    aborting = true;
    console.log(`\n${reason}`);
    waiter.interrupt();
  };

  const probe = new BenchProbe({
    apiKey: cfg.apiKey,
    pingIntervalMs: cfg.pingIntervalMs,
    wsUrl: cfg.wsUrl,
  });

  process.on("SIGINT", () => {
    abort("Interrupted — writing partial report.");
  });

  console.log(`Connecting to ${cfg.wsUrl}…`);
  try {
    await Promise.race([
      probe.start(),
      rejectAfter(CONNECT_TIMEOUT_MS, "Connection"),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to connect:", message);
    console.error(
      "Hint: a 429 or timeout usually means the API key hit its rate/connection limit. " +
        "The Free plan allows one connection; close other clients using this key and retry."
    );
    probe.stop();
    process.exit(1);
  }

  const startedAt = new Date().toISOString();

  if (cfg.warmupSec > 0 && !aborting) {
    console.log(`Warming up ${cfg.warmupSec}s…`);
    await waiter.wait(cfg.warmupSec * 1000);
  }

  probe.beginRecording();

  if (!aborting) {
    console.log(`Measuring ${cfg.durationSec}s… (Ctrl-C to stop early)`);
    await waiter.wait(cfg.durationSec * 1000);
  }

  const report = buildReport({
    config: {
      durationSec: cfg.durationSec,
      pingIntervalMs: cfg.pingIntervalMs,
      warmupSec: cfg.warmupSec,
      wsUrl: cfg.wsUrl,
    },
    probe: probe.stop(),
    startedAt,
  });

  console.log(`\n${formatReport(report)}`);
  const path = writeReport(report, cfg.outDir);
  console.log(`\nJSON: ${path}`);
  process.exit(0);
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
