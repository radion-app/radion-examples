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

import {
  errorCode,
  onStatus,
  payload,
  requireApiKey,
  short,
} from "../../shared/utils";
import type { EventData } from "../../shared/utils";

const wallets = process.argv.slice(2);
if (wallets.length === 0) {
  console.error("Usage: tsx index.ts 0xWALLET [0xWALLET...]");
  process.exit(1);
}

// Friendly one-line summaries per event type; fall back to the raw type.
const describe = (d: EventData): string => {
  switch (d.type) {
    case "order_filled_v1":
    case "order_filled_v2": {
      return `traded ${short(d.tokenId)} (${d.side === 1 ? "sell" : "buy"})`;
    }
    case "transfer": {
      return `transferred to ${short(d.to)}`;
    }
    case "transfer_single":
    case "transfer_batch": {
      return `moved position token(s)`;
    }
    case "ctf_position_split": {
      return `split collateral on ${short(d.conditionId)}`;
    }
    case "ctf_positions_merge": {
      return `merged positions on ${short(d.conditionId)}`;
    }
    case "ctf_payout_redemption":
    case "positions_redeemed": {
      return `redeemed on ${short(d.conditionId)}`;
    }
    default: {
      return d?.type ?? "unknown";
    }
  }
};

console.log(`Watching ${wallets.length} wallet(s) for any activity…`);

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => console.log(`[${s}]`));
radion.realtime.on("error", (err) =>
  console.error("error:", errorCode(err), err.message)
);
radion.realtime.on("event", (e) => {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`🔔 ${time}  ${describe(payload(e))}`);
});

radion.realtime.subscribe({
  channel: "wallets",
  filters: { wallets },
  id: "alerts",
});
await radion.realtime.connect();
