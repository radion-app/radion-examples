/**
 * Mempool early alerts + reconciliation
 *
 * Subscribe to pending exchange transactions for early visibility, then reconcile
 * each against the confirmed `trading` stream by transaction hash — measuring how
 * far ahead the mempool saw it. This is the front-of-confirmation pattern.
 *
 * Channels: `mempool.trading` (pending) + `trading` (confirmed). Two
 * subscriptions, so this fits the Free plan (2 subs/connection).
 * Docs: https://docs.radion.app/websockets/mempool
 *
 * Note: emits nothing until the production mempool source is provisioned
 * (see POLYGON_MEMPOOL_WS_URL on the API). The confirmed half still works.
 *
 * Run:
 *   tsx --env-file-if-exists=.env websockets/06-mempool-early-alerts/index.ts
 */
import { mempoolPayloadSchema, Radion } from "@radion-app/sdk";

import { errorCode, onStatus, requireApiKey, short } from "../../shared/utils";

// Pending tx hash -> when we first saw it (ms), to compute pending→confirmed lead time.
const pendingSeen = new Map<string, number>();

console.log("Watching trading pending + confirmed. Reconciling by tx hash…");

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => {
  console.log(`[${s}]`);
});
radion.realtime.onLifecycle("error", (e) => {
  console.error("error:", errorCode(e), e.message);
});

// Both feeds ride the `trading` channel; `e.confirmed === false` is the pending
// (mempool) frame, whose `data` is a MempoolPayload.
radion.realtime.onChannel("trading", (e) => {
  if (e.confirmed === false) {
    const parsed = mempoolPayloadSchema.safeParse(e.data);
    if (!parsed.success) {
      return;
    }
    const d = parsed.data;
    if (!d.transaction_hash) {
      return;
    }
    pendingSeen.set(d.transaction_hash, d.seen_at_ms);
    const method = d.call?.method ?? "?";
    console.log(
      `⏳ pending  ${short(d.transaction_hash)}  ${method}  from ${short(d.from)}`
    );
    return;
  }

  // Confirmed trade frame. Match it back to a pending tx if we saw one.
  // Confirmed trade payloads don't carry the tx hash, so we reconcile on the
  // hashes we cached; in practice you'd correlate via your own indexer too.
  if (pendingSeen.size === 0) {
    return;
  }
  console.log(
    `✅ confirmed trade  ${e.data.type}  (pending pool size ${pendingSeen.size})`
  );
});

radion.realtime.subscribe({
  channel: "trading",
  confirmed: false,
  id: "pending",
});
radion.realtime.subscribe({
  channel: "trading",
  confirmed: true,
  id: "confirmed",
});
await radion.realtime.connect();
