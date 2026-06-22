/**
 * Resolution watcher
 *
 * Listen to UMA oracle lifecycle events and print the moment a market's outcome
 * is proposed or resolved. Wire the alert into notifications, position closing,
 * or settlement automation.
 *
 * Channel: `oracle` (UMA Adapter + Optimistic Oracle events).
 * Docs: https://docs.radion.app/websockets/channels/oracle
 *
 * Run:
 *   bun run websockets/07-resolution-watcher/index.ts
 */
import { connect, short } from "../../shared/radion-ws";
import type { Frame } from "../../shared/radion-ws";

// Oracle event types that signal the resolution lifecycle moving forward.
const INTERESTING = /resolve|propose|settle|price|answer|dispute/iu;

console.log("Watching oracle resolutions…");

connect({
  onError: (f: Frame) => console.error("error:", f.code, f.message),
  onEvent: (d) => {
    const type = d?.type ?? "unknown";
    const time = new Date().toISOString().slice(11, 19);
    const id = d?.questionId ?? d?.conditionId ?? "";
    const flag = INTERESTING.test(type) ? "⚑" : "·";
    console.log(`${flag} ${time}  ${type}  ${short(id)}`);
  },
  onStatus: (s) => console.log(`[${s}]`),
  subscriptions: [{ channel: "oracle", id: "oracle" }],
});
