/**
 * Resolution watcher
 *
 * Listen to settlement events and print the moment a market's outcome is
 * reported or resolved. Wire the alert into notifications, position closing,
 * or settlement automation.
 *
 * Channel: `resolution` (condition resolution + outcome/result reporting).
 * Docs: https://docs.radion.app/websockets/channels/resolution
 *
 * Run:
 *   tsx --env-file-if-exists=.env websockets/07-resolution-watcher/index.ts
 */
import { Radion } from "@radion-app/sdk";

import { errorCode, onStatus, requireApiKey, short } from "../../shared/utils";

// Resolution event types that mark a settled / reported outcome.
const INTERESTING = /resolved|reported/iu;

console.log("Watching market resolutions…");

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => {
  console.log(`[${s}]`);
});
radion.realtime.onLifecycle("error", (e) => {
  console.error("error:", errorCode(e), e.message);
});
radion.realtime.onChannel("resolution", (e) => {
  const { type, conditionId } = e.data;
  const time = new Date().toISOString().slice(11, 19);
  const id = conditionId ?? "";
  const flag = INTERESTING.test(type) ? "⚑" : "·";
  console.log(`${flag} ${time}  ${type}  ${short(id)}`);
});

radion.realtime.subscribe({ channel: "resolution", id: "resolution" });
await radion.realtime.connect();
