/**
 * Single-market monitor
 *
 * Pick one market (by `market_ids` or its `token_ids`) and surface everything
 * happening on it — fills, splits, merges, redemptions — as a live activity log
 * with a running tally per event type.
 *
 * Channel: `markets` (requires at least one of `market_ids` / `token_ids`).
 * Docs: https://docs.radion.app/websockets/channels/overview
 *
 * Run:
 *   tsx --env-file-if-exists=.env websockets/05-market-monitor/index.ts --market 0xCONDITION_ID
 *   tsx --env-file-if-exists=.env websockets/05-market-monitor/index.ts --token 0xTOKEN_ID
 */
import { Radion } from "@radion-app/sdk";

import {
  errorCode,
  onStatus,
  payload,
  requireApiKey,
  short,
} from "../../shared/utils";

const [flag, value] = process.argv.slice(2);
if ((flag !== "--market" && flag !== "--token") || !value) {
  console.error(
    "Usage: tsx index.ts --market 0xCONDITION_ID | --token 0xTOKEN_ID"
  );
  process.exit(1);
}

const filters =
  flag === "--market" ? { market_ids: [value] } : { token_ids: [value] };
const counts = new Map<string, number>();

console.log(
  `Monitoring ${flag === "--market" ? "market" : "token"} ${short(value)}…`
);

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => console.log(`[${s}]`));
radion.realtime.on("error", (err) =>
  console.error("error:", errorCode(err), err.message)
);
radion.realtime.on("event", (e) => {
  const d = payload(e);
  const type = d?.type ?? "unknown";
  counts.set(type, (counts.get(type) ?? 0) + 1);
  const tally = [...counts.entries()].map(([t, c]) => `${t}:${c}`).join("  ");
  console.log(
    `${new Date().toISOString().slice(11, 19)}  ${type}\n   ${tally}`
  );
});

radion.realtime.subscribe({ channel: "markets", filters, id: "market" });
await radion.realtime.connect();
