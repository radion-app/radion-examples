/**
 * Copytrading mirror
 *
 * Follow one or more trader wallets. Whenever a watched address fills an order,
 * print the trade you'd mirror to copy their position. This is the live
 * counterpart to a copytrading backtest: same signal, in real time.
 *
 * Channel: `trades` with a `wallets` filter (only fills involving your wallets).
 * Docs: https://docs.radion.app/websockets/channels/trades
 *
 * Run:
 *   tsx --env-file-if-exists=.env websockets/01-copytrading-mirror/index.ts 0xWALLET [0xWALLET...]
 */
import { Radion } from "@radion-app/sdk";

import {
  errorCode,
  hexToUsdc,
  onStatus,
  requireApiKey,
  short,
} from "../../shared/utils";

const wallets = process.argv.slice(2);
if (wallets.length === 0) {
  console.error("Usage: tsx index.ts 0xWALLET [0xWALLET...]");
  process.exit(1);
}
const watched = new Set(wallets.map((w) => w.toLowerCase()));

console.log(`Mirroring ${wallets.length} wallet(s). Waiting for fills…`);

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => {
  console.log(`[${s}]`);
});
radion.realtime.onLifecycle("error", (e) => {
  console.error("error:", errorCode(e), e.message);
});
radion.realtime.onChannel("trades", (e) => {
  const d = e.data;
  // Only v2 fills carry side/tokenId; handle both fill variants.
  const isFill = d.type === "order_filled_v1" || d.type === "order_filled_v2";
  if (!isFill) {
    return;
  }

  // Decide which side of the fill is *our* trader, then mirror their action.
  const makerWatched = watched.has(String(d.maker).toLowerCase());
  const trader = makerWatched ? d.maker : d.taker;
  // side is v2-only; v1 fills have no explicit side, so default to BUY
  const sideLabel = d.side === 1 ? "SELL" : "BUY";
  const usdc = hexToUsdc(d.takerAmountFilled);

  console.log(
    `→ MIRROR ${sideLabel}  trader=${short(trader)}  token=${short(d.tokenId)}  ~$${usdc.toFixed(2)}  (${d.type})`
  );
});

radion.realtime.subscribe({
  channel: "trades",
  filters: { wallets },
  id: "copy",
});
await radion.realtime.connect();
