/**
 * Benchmark configuration: flag + env parsing with sensible defaults.
 *
 * Kept pure and side-effect free so it can be unit-tested by passing an
 * explicit argv and env. `resolveConfig` is the only entry the CLI needs.
 */
import { DEFAULT_WS_URL } from "@radion-app/sdk";

/** Fully-resolved settings the harness runs against. */
export interface BenchConfig {
  apiKey: string;
  wsUrl: string;
  /** Total measurement window, seconds (excludes warmup). */
  durationSec: number;
  /** Leading seconds whose samples are discarded (TLS resume, buffer fill). */
  warmupSec: number;
  /** Interval between raw-ws pings, milliseconds. */
  pingIntervalMs: number;
  /** Directory the JSON report is written to. */
  outDir: string;
}

/** Built-in defaults, overridable per flag. */
export const DEFAULTS = {
  durationSec: 300,
  outDir: "bench/results",
  pingIntervalMs: 1000,
  warmupSec: 5,
} as const;

/**
 * Parse `--key value` and `--key=value` pairs into a flat map. Values are left
 * as strings; validation happens in {@link resolveConfig}. Unknown flags pass
 * through untouched — callers only read the keys they care about.
 */
export const parseFlags = (argv: readonly string[]): Record<string, string> => {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[body] = next;
      i += 1;
    } else {
      flags[body] = "true";
    }
  }
  return flags;
};

/** Parse a strictly-positive number flag, or fall back to a default. */
const positive = (
  raw: string | undefined,
  fallback: number,
  name: string
): number => {
  if (raw === undefined) {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `Invalid --${name}: expected a positive number, got "${raw}".`
    );
  }
  return n;
};

/** Parse a non-negative number flag (allows 0), or fall back to a default. */
const nonNegative = (
  raw: string | undefined,
  fallback: number,
  name: string
): number => {
  if (raw === undefined) {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(
      `Invalid --${name}: expected a non-negative number, got "${raw}".`
    );
  }
  return n;
};

/**
 * Resolve CLI args + environment into a {@link BenchConfig}. Throws with a
 * friendly hint when the API key is missing or a numeric flag is malformed.
 */
export const resolveConfig = (
  argv: readonly string[],
  env: NodeJS.ProcessEnv
): BenchConfig => {
  const flags = parseFlags(argv);

  const apiKey = env.RADION_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    throw new Error(
      "Missing RADION_API_KEY. Copy .env.example to .env and set your key (https://radion.app)."
    );
  }

  const durationSec = positive(
    flags.duration,
    DEFAULTS.durationSec,
    "duration"
  );
  const warmupSec = nonNegative(flags.warmup, DEFAULTS.warmupSec, "warmup");
  if (warmupSec >= durationSec) {
    throw new Error(
      `--warmup (${warmupSec}s) must be shorter than --duration (${durationSec}s).`
    );
  }

  return {
    apiKey,
    durationSec,
    outDir: flags.out ?? DEFAULTS.outDir,
    pingIntervalMs: positive(
      flags["ping-interval"],
      DEFAULTS.pingIntervalMs,
      "ping-interval"
    ),
    warmupSec,
    wsUrl: env.RADION_WS ?? DEFAULT_WS_URL,
  };
};
