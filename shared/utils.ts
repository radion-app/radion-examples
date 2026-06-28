/**
 * Small display helpers shared across the examples.
 *
 * The connection, reconnect, heartbeat and resubscribe logic now lives in the
 * `@radion-app/sdk` package — these are just formatting utilities and a thin
 * lifecycle-logging helper the examples build on.
 */
import { RadionServerError } from "@radion-app/sdk";
import type { RealtimeClient } from "@radion-app/sdk";

/** The server error code for an error, when it is a {@link RadionServerError}. */
export const errorCode = (err: Error): string | undefined =>
  err instanceof RadionServerError ? err.code : undefined;

/** Read `RADION_API_KEY` or exit with a friendly hint. */
export const requireApiKey = (): string => {
  const apiKey = process.env.RADION_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    throw new Error(
      "Missing RADION_API_KEY. Copy .env.example to .env and set your key (https://radion.app)."
    );
  }
  return apiKey;
};

/**
 * Wire the SDK's lifecycle events to a single status callback, mirroring the
 * connecting/open/reconnecting/closed states the examples print.
 */
export const onStatus = (
  realtime: RealtimeClient,
  report: (status: string, detail?: string) => void
): void => {
  realtime.onLifecycle("open", () => {
    report("open");
  });
  realtime.onLifecycle("close", ({ code, reason }) => {
    report("closed", `${code}${reason ? ` ${reason}` : ""}`);
  });
  realtime.onLifecycle("reconnect", ({ attempt, delayMs }) => {
    report("reconnecting", `#${attempt} in ${delayMs}ms`);
  });
};

/** Polymarket amounts arrive as hex strings. Convert to a USDC float (6 decimals). */
export const hexToUsdc = (hex?: string): number => {
  if (hex === undefined || hex === "") {
    return 0;
  }
  try {
    return Number(BigInt(hex)) / 1e6;
  } catch {
    return 0;
  }
};

/** Shorten a hex address/hash for display: 0x1234…abcd */
export const short = (hex?: string): string => {
  if (hex === undefined || hex.length < 12) {
    return hex ?? "";
  }
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`;
};
