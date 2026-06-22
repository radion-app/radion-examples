/**
 * Live price ticker
 *
 * Subscribe to specific outcome tokens and render a continuously-updating
 * last-traded price per token, with the direction of the last move.
 *
 * Channel: `prices` with an optional `token_ids` filter. The `prices` payload is
 * the simple shape `{ token_id, price, timestamp_ms }` (no `data.type`).
 * Docs: https://docs.radion.app/websockets/channels/prices
 *
 * Run:
 *   bun run websockets/04-live-price-ticker/index.ts 0xTOKEN [0xTOKEN...]
 *   (no args = all tokens)
 */
import { connect, short, type Frame } from "../../shared/radion-ws";

const tokenIds = process.argv.slice(2);
const last = new Map<string, { price: number; dir: string }>();

function render() {
  console.clear();
  console.log("📈 Live prices (USDC per share)\n");
  for (const [token, { price, dir }] of last) {
    console.log(`  ${short(token)}   ${dir} ${price.toFixed(3)}`);
  }
}

console.log(tokenIds.length ? `Tracking ${tokenIds.length} token(s)…` : "Tracking all tokens…");

connect({
  subscriptions: [
    { id: "ticker", channel: "prices", ...(tokenIds.length ? { filters: { token_ids: tokenIds } } : {}) },
  ],
  onStatus: (s) => s !== "open" && console.log(`[${s}]`),
  onError: (f: Frame) => console.error("error:", f.code, f.message),
  onEvent: (d) => {
    const prev = last.get(d.token_id)?.price;
    const dir = prev === undefined || d.price === prev ? "→" : d.price > prev ? "▲" : "▼";
    last.set(d.token_id, { price: d.price, dir });
    render();
  },
});
