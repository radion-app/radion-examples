/**
 * Resilient client
 *
 * A minimal but production-shaped connection that shows the reliability features
 * the shared helper gives you for free:
 *   - `X-API-Key` upgrade header (never in the URL),
 *   - exponential-backoff reconnect,
 *   - automatic resubscribe after reconnect,
 *   - application-level ping,
 *   - reconnect on `lagged`, stop on `key_revoked` / `revalidation_failed`.
 *
 * It subscribes to `global` and just reports lifecycle + throughput so you can
 * watch it survive drops. Kill your network for a few seconds to see it recover.
 *
 * Docs: https://docs.radion.app/websockets/connection-state
 *
 * Run:
 *   bun run websockets/08-resilient-client/index.ts
 */
import { connect } from "../../shared/radion-ws";
import type { Frame } from "../../shared/radion-ws";

let events = 0;
// first "connecting" isn't a reconnect
let reconnects = -1;

const client = connect({
  onError: (f: Frame) => {
    if (f.code === "lagged") {
      console.warn(`lagged: ${f.skipped} events dropped, reconnecting`);
    } else {
      console.error("error:", f.code, f.message);
    }
  },
  onEvent: () => {
    events += 1;
  },
  onStatus: (s, detail) => {
    if (s === "reconnecting") {
      reconnects += 1;
    }
    console.log(`[status] ${s}${detail ? ` (${detail})` : ""}`);
    if (s === "fatal") {
      console.error("Fatal: API key revoked or revalidation failed. Stopping.");
      process.exit(1);
    }
  },
  subscriptions: [{ channel: "global", id: "g" }],
});

// Periodic throughput report.
setInterval(() => {
  console.log(`events=${events}  reconnects=${Math.max(0, reconnects)}`);
}, 5000);

// Clean shutdown on Ctrl-C.
process.on("SIGINT", () => {
  console.log("\nclosing…");
  client.close();
  process.exit(0);
});
