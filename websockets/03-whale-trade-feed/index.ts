/**
 * Whale trade feed
 *
 * Stream only fills above a USD threshold into a rolling leaderboard of the
 * biggest recent trades. Useful for "smart money" / large-flow dashboards.
 *
 * Channel: `trading` with a `min_usd` filter (server-side notional threshold).
 * Docs: https://docs.radion.app/websockets/channels/trading
 *
 * Run:
 *   tsx --env-file-if-exists=.env websockets/03-whale-trade-feed/index.ts [minUsd=10000]
 */
import { Radion } from "@radion-app/sdk";

import {
  errorCode,
  hexToUsdc,
  onStatus,
  requireApiKey,
  short,
} from "../../shared/utils";

const minUsd = Number(process.argv[2] ?? 10_000);
const TOP_N = 10;
const board: { usd: number; token: string; taker: string; at: string }[] = [];

const render = () => {
  console.clear();
  console.log(
    `🐋 Whale trades ≥ $${minUsd.toLocaleString()}  (top ${TOP_N})\n`
  );
  if (board.length === 0) {
    console.log("  waiting for large fills…");
    return;
  }
  const top = [...board].toSorted((a, b) => b.usd - a.usd).slice(0, TOP_N);
  for (const [i, t] of top.entries()) {
    console.log(
      `  ${String(i + 1).padStart(2)}.  $${t.usd.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(10)}   token ${short(t.token)}   taker ${short(t.taker)}   ${t.at}`
    );
  }
};

console.log("Connecting…");

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => {
  if (s !== "open") {
    console.log(`[${s}]`);
  }
});
radion.realtime.onLifecycle("error", (e) => {
  console.error("error:", errorCode(e), e.message);
});
radion.realtime.onChannel("trading", (e) => {
  const d = e.data;
  const usd = hexToUsdc(d.takerAmountFilled);
  board.push({
    at: new Date().toISOString().slice(11, 19),
    taker: d.taker ?? "",
    token: d.tokenId ?? "",
    usd,
  });
  if (board.length > 200) {
    board.shift();
  }
  render();
});

radion.realtime.subscribe({
  channel: "trading",
  filters: { min_usd: minUsd },
  id: "whales",
});
await radion.realtime.connect();
