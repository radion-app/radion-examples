import { describe, expect, it } from "vitest";

import { DEFAULTS, parseFlags, resolveConfig } from "./config";

const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  RADION_API_KEY: "rk_test",
  ...extra,
});

describe("parseFlags", () => {
  it("parses --key value and --key=value", () => {
    expect(parseFlags(["--duration", "60", "--warmup=3"])).toEqual({
      duration: "60",
      warmup: "3",
    });
  });

  it("treats a trailing flag with no value as boolean true", () => {
    expect(parseFlags(["--verbose"])).toEqual({ verbose: "true" });
  });

  it("ignores non-flag tokens", () => {
    expect(parseFlags(["bench", "--duration", "10"])).toEqual({
      duration: "10",
    });
  });
});

describe("resolveConfig", () => {
  it("applies defaults when no flags given", () => {
    const cfg = resolveConfig([], env());
    expect(cfg.durationSec).toBe(DEFAULTS.durationSec);
    expect(cfg.warmupSec).toBe(DEFAULTS.warmupSec);
    expect(cfg.pingIntervalMs).toBe(DEFAULTS.pingIntervalMs);
    expect(cfg.outDir).toBe(DEFAULTS.outDir);
    expect(cfg.wsUrl).toBe("wss://api.radion.app/ws");
  });

  it("honours flag overrides and RADION_WS", () => {
    const cfg = resolveConfig(
      [
        "--duration",
        "30",
        "--warmup",
        "2",
        "--ping-interval",
        "500",
        "--out",
        "/tmp/x",
      ],
      env({ RADION_WS: "wss://example/ws" })
    );
    expect(cfg.durationSec).toBe(30);
    expect(cfg.warmupSec).toBe(2);
    expect(cfg.pingIntervalMs).toBe(500);
    expect(cfg.outDir).toBe("/tmp/x");
    expect(cfg.wsUrl).toBe("wss://example/ws");
  });

  it("allows a zero warmup", () => {
    expect(resolveConfig(["--warmup", "0"], env()).warmupSec).toBe(0);
  });

  it("throws when the API key is missing", () => {
    expect(() => resolveConfig([], {})).toThrow(/RADION_API_KEY/u);
  });

  it("throws on a non-positive duration", () => {
    expect(() => resolveConfig(["--duration", "0"], env())).toThrow(
      /duration/u
    );
    expect(() => resolveConfig(["--duration", "-5"], env())).toThrow(
      /duration/u
    );
    expect(() => resolveConfig(["--duration", "abc"], env())).toThrow(
      /duration/u
    );
  });

  it("throws when warmup is not shorter than duration", () => {
    expect(() =>
      resolveConfig(["--duration", "10", "--warmup", "10"], env())
    ).toThrow(/warmup/u);
  });
});
