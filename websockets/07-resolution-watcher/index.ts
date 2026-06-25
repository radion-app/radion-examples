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
 *   tsx --env-file-if-exists=.env websockets/07-resolution-watcher/index.ts
 */
import { Radion } from "@radion-app/sdk";

import {
  errorCode,
  onStatus,
  payload,
  requireApiKey,
  short,
} from "../../shared/utils";

// Oracle event types that signal the resolution lifecycle moving forward.
const INTERESTING = /resolve|propose|settle|price|answer|dispute/iu;

console.log("Watching oracle resolutions…");

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => console.log(`[${s}]`));
radion.realtime.on("error", (err) =>
  console.error("error:", errorCode(err), err.message)
);
radion.realtime.on("event", (e) => {
  const d = payload(e);
  const type = d?.type ?? "unknown";
  const time = new Date().toISOString().slice(11, 19);
  const id = d?.questionId ?? d?.conditionId ?? "";
  const flag = INTERESTING.test(type) ? "⚑" : "·";
  console.log(`${flag} ${time}  ${type}  ${short(id)}`);
});

radion.realtime.subscribe({ channel: "oracle", id: "oracle" });
await radion.realtime.connect();
