/**
 * Live price ticker
 *
 * Subscribe to specific outcome tokens and render a continuously-updating
 * price per token, with the direction of the last move. Prices come from the
 * CLOB price feed `clob.prices` — batched order-book price changes.
 *
 * Channel: `clob.prices` with a required `token_ids` filter. Each update carries
 * a `changes` array; each entry has an `asset_id` and its new `price`.
 * Docs: https://docs.radion.app/websockets/channels/clob
 *
 * Run:
 *   tsx --env-file-if-exists=.env websockets/04-live-price-ticker/index.ts 0xTOKEN [0xTOKEN...]
 */
import { Radion } from "@radion-app/sdk";

import { errorCode, onStatus, requireApiKey, short } from "../../shared/utils";

const tokenIds = process.argv.slice(2);
if (tokenIds.length === 0) {
  console.error("Usage: tsx index.ts 0xTOKEN [0xTOKEN...]");
  process.exit(1);
}
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

console.log(`Tracking ${tokenIds.length} token(s)…`);

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => {
  if (s !== "open") {
    console.log(`[${s}]`);
  }
});
radion.realtime.onLifecycle("error", (e) => {
  console.error("error:", errorCode(e), e.message);
});
radion.realtime.onChannel("clob.prices", (e) => {
  for (const change of e.data.changes) {
    // clob.prices sends `price` as a string; coerce once to a number.
    const price = Number(change.price);
    const prev = last.get(change.asset_id)?.price;
    last.set(change.asset_id, {
      dir: moveArrow(price, prev),
      price,
    });
  }
  render();
});

radion.realtime.subscribe({
  channel: "clob.prices",
  filters: { token_ids: tokenIds },
  id: "ticker",
});
await radion.realtime.connect();
