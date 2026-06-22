/**
 * Whale trade feed
 *
 * Stream only fills above a USD threshold into a rolling leaderboard of the
 * biggest recent trades. Useful for "smart money" / large-flow dashboards.
 *
 * Channel: `large_trades` with a `min_usd` filter (server-side notional filter).
 * Docs: https://docs.radion.app/websockets/channels/overview
 *
 * Run:
 *   bun run websockets/03-whale-trade-feed/index.ts [minUsd=10000]
 */
import { connect, hexToUsdc, short } from "../../shared/radion-ws";
import type { Frame } from "../../shared/radion-ws";

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

connect({
  onError: (f: Frame) => console.error("error:", f.code, f.message),
  onEvent: (d) => {
    const usd = hexToUsdc(d.takerAmountFilled);
    board.push({
      at: new Date().toISOString().slice(11, 19),
      taker: d.taker,
      token: d.tokenId,
      usd,
    });
    if (board.length > 200) {
      board.shift();
    }
    render();
  },
  onStatus: (s) => s !== "open" && console.log(`[${s}]`),
  subscriptions: [
    { channel: "large_trades", filters: { min_usd: minUsd }, id: "whales" },
  ],
});
