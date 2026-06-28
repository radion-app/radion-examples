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
 *   tsx --env-file-if-exists=.env websockets/02-wallet-alerts/index.ts 0xWALLET [0xWALLET...]
 */
import { Radion } from "@radion-app/sdk";
import type { AnyConfirmedPayload } from "@radion-app/sdk";

import { errorCode, onStatus, requireApiKey, short } from "../../shared/utils";

const wallets = process.argv.slice(2);
if (wallets.length === 0) {
  console.error("Usage: tsx index.ts 0xWALLET [0xWALLET...]");
  process.exit(1);
}

// Friendly one-line summaries per event type; fall back to the raw type.
const describe = (d: AnyConfirmedPayload): string => {
  if (d.type === "order_filled_v1" || d.type === "order_filled_v2") {
    return `traded ${short(d.tokenId)} (${d.side === 1 ? "sell" : "buy"})`;
  }
  if (d.type === "transfer") {
    return `transferred to ${short(d.to)}`;
  }
  if (d.type === "transfer_single" || d.type === "transfer_batch") {
    return `moved position token(s)`;
  }
  if (d.type === "ctf_position_split") {
    return `split collateral on ${short(d.conditionId)}`;
  }
  if (d.type === "ctf_positions_merge") {
    return `merged positions on ${short(d.conditionId)}`;
  }
  if (d.type === "ctf_payout_redemption" || d.type === "positions_redeemed") {
    return `redeemed on ${short(d.conditionId)}`;
  }
  return d.type;
};

console.log(`Watching ${wallets.length} wallet(s) for any activity…`);

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => {
  console.log(`[${s}]`);
});
radion.realtime.onLifecycle("error", (e) => {
  console.error("error:", errorCode(e), e.message);
});
radion.realtime.onChannel("wallets", (e) => {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`🔔 ${time}  ${describe(e.data)}`);
});

radion.realtime.subscribe({
  channel: "wallets",
  filters: { wallets },
  id: "alerts",
});
await radion.realtime.connect();
