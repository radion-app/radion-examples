/**
 * Resilient client
 *
 * A minimal but production-shaped connection that shows the reliability features
 * the SDK gives you for free:
 *   - `X-API-Key` upgrade header (never in the URL),
 *   - exponential-backoff reconnect,
 *   - automatic resubscribe after reconnect,
 *   - heartbeat ping / stale detection,
 *   - server error frames surfaced on the `error` event (e.g. `lagged`),
 *   - stop on `key_revoked` / `revalidation_failed`.
 *
 * It subscribes to `global` and just reports lifecycle + throughput so you can
 * watch it survive drops. Kill your network for a few seconds to see it recover.
 *
 * Docs: https://docs.radion.app/websockets/connection-state
 *
 * Run:
 *   tsx --env-file-if-exists=.env websockets/08-resilient-client/index.ts
 */
import { Radion } from "@radion-app/sdk";

import { errorCode, requireApiKey } from "../../shared/utils";

const FATAL = new Set(["key_revoked", "revalidation_failed"]);

let events = 0;
let reconnects = 0;

const radion = new Radion({ apiKey: requireApiKey() });

radion.realtime.onLifecycle("open", () => {
  console.log("[status] open");
});
radion.realtime.onLifecycle("reconnect", ({ attempt, delayMs }) => {
  reconnects = attempt;
  console.log(`[status] reconnecting (#${attempt} in ${delayMs}ms)`);
});
radion.realtime.onLifecycle("close", ({ code }) => {
  console.log(`[status] closed (${code})`);
});
radion.realtime.onLifecycle("error", (e) => {
  const code = errorCode(e);
  if (code === "lagged") {
    console.warn("lagged: fell behind the buffer, some events were dropped");
    return;
  }
  if (code !== undefined && FATAL.has(code)) {
    console.error("Fatal: API key revoked or revalidation failed. Stopping.");
    radion.realtime.close();
    process.exit(1);
  }
  console.error("error:", code, e.message);
});
radion.realtime.onChannel("global", () => {
  events += 1;
});

radion.realtime.subscribe({ channel: "global", id: "g" });
await radion.realtime.connect();

// Periodic throughput report.
setInterval(() => {
  console.log(`events=${events}  reconnects=${reconnects}`);
}, 5000);

// Clean shutdown on Ctrl-C.
process.on("SIGINT", () => {
  console.log("\nclosing…");
  radion.realtime.close();
  process.exit(0);
});
