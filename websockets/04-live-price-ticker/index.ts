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
import { connect, short } from "../../shared/radion-ws";
import type { Frame } from "../../shared/radion-ws";

const tokenIds = process.argv.slice(2);
const last = new Map<string, { price: number; dir: string }>();

const render = () => {
  console.clear();
  console.log("📈 Live prices (USDC per share)\n");
  for (const [token, { price, dir }] of last) {
    console.log(`  ${short(token)}   ${dir} ${price.toFixed(3)}`);
  }
};

// Arrow showing the last move direction for a token.
const moveArrow = (price: number, prev?: number): string => {
  if (prev === undefined || price === prev) {
    return "→";
  }
  return price > prev ? "▲" : "▼";
};

console.log(
  tokenIds.length
    ? `Tracking ${tokenIds.length} token(s)…`
    : "Tracking all tokens…"
);

connect({
  onError: (f: Frame) => console.error("error:", f.code, f.message),
  onEvent: (d) => {
    const prev = last.get(d.token_id)?.price;
    const dir = moveArrow(d.price, prev);
    last.set(d.token_id, { dir, price: d.price });
    render();
  },
  onStatus: (s) => s !== "open" && console.log(`[${s}]`),
  subscriptions: [
    {
      channel: "prices",
      id: "ticker",
      ...(tokenIds.length ? { filters: { token_ids: tokenIds } } : {}),
    },
  ],
});
