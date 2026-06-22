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
 *   bun run websockets/05-market-monitor/index.ts --market 0xCONDITION_ID
 *   bun run websockets/05-market-monitor/index.ts --token 0xTOKEN_ID
 */
import { connect, short, type Frame } from "../../shared/radion-ws";

const flag = process.argv[2];
const value = process.argv[3];
if ((flag !== "--market" && flag !== "--token") || !value) {
  console.error("Usage: bun run index.ts --market 0xCONDITION_ID | --token 0xTOKEN_ID");
  process.exit(1);
}

const filters = flag === "--market" ? { market_ids: [value] } : { token_ids: [value] };
const counts = new Map<string, number>();

console.log(`Monitoring ${flag === "--market" ? "market" : "token"} ${short(value)}…`);

connect({
  subscriptions: [{ id: "market", channel: "markets", filters }],
  onStatus: (s) => console.log(`[${s}]`),
  onError: (f: Frame) => console.error("error:", f.code, f.message),
  onEvent: (d) => {
    const type = d?.type ?? "unknown";
    counts.set(type, (counts.get(type) ?? 0) + 1);
    const tally = [...counts.entries()].map(([t, c]) => `${t}:${c}`).join("  ");
    console.log(`${new Date().toISOString().slice(11, 19)}  ${type}\n   ${tally}`);
  },
});
