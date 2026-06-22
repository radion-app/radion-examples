/**
 * Wallet alerts
 *
 * Watch a set of addresses and emit an alert on ANY activity — trades, transfers,
 * redemptions, splits, merges. The `wallets` channel re-emits every event type
 * involving a watched address, so it's the firehose for "what is this wallet doing".
 *
 * Channel: `wallets` (requires a non-empty `wallets` filter).
 * Docs: https://docs.radion.app/websockets/channels/overview#filtered-views
 *
 * Run:
 *   bun run websockets/02-wallet-alerts/index.ts 0xWALLET [0xWALLET...]
 */
import { connect, short, type Frame } from "../../shared/radion-ws";

const wallets = process.argv.slice(2);
if (wallets.length === 0) {
  console.error("Usage: bun run index.ts 0xWALLET [0xWALLET...]");
  process.exit(1);
}

// Friendly one-line summaries per event type; fall back to the raw type.
function describe(d: any): string {
  switch (d?.type) {
    case "order_filled_v1":
    case "order_filled_v2":
      return `traded ${short(d.tokenId)} (${d.side === 1 ? "sell" : "buy"})`;
    case "transfer":
      return `transferred to ${short(d.to)}`;
    case "transfer_single":
    case "transfer_batch":
      return `moved position token(s)`;
    case "ctf_position_split":
      return `split collateral on ${short(d.conditionId)}`;
    case "ctf_positions_merge":
      return `merged positions on ${short(d.conditionId)}`;
    case "ctf_payout_redemption":
    case "positions_redeemed":
      return `redeemed on ${short(d.conditionId)}`;
    default:
      return d?.type ?? "unknown";
  }
}

console.log(`Watching ${wallets.length} wallet(s) for any activity…`);

connect({
  subscriptions: [{ id: "alerts", channel: "wallets", filters: { wallets } }],
  onStatus: (s) => console.log(`[${s}]`),
  onError: (f: Frame) => console.error("error:", f.code, f.message),
  onEvent: (d) => {
    const time = new Date().toISOString().slice(11, 19);
    console.log(`🔔 ${time}  ${describe(d)}`);
  },
});
