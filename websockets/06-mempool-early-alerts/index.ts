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
import { Radion } from "@radion-app/sdk";

import { errorCode, onStatus, requireApiKey, short } from "../../shared/utils";

// Pending tx hash -> when we first saw it (ms), to compute pending→confirmed lead time.
const pendingSeen = new Map<string, number>();

// Mempool payloads aren't part of the SDK's typed channels, so read their
// fields off the raw `unknown` data with small runtime checks.
const str = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

console.log("Watching mempool.trading + trading. Reconciling by tx hash…");

const radion = new Radion({ apiKey: requireApiKey() });

onStatus(radion.realtime, (s) => {
  console.log(`[${s}]`);
});
radion.realtime.onLifecycle("error", (e) => {
  console.error("error:", errorCode(e), e.message);
});

radion.realtime.onChannel("mempool.trading", (e) => {
  const d = e.data;
  const hash = str(d.transaction_hash);
  if (hash === undefined || hash === "") {
    return;
  }
  pendingSeen.set(
    hash,
    typeof d.seen_at_ms === "number" ? d.seen_at_ms : Date.now()
  );
  const { call } = d;
  const method =
    typeof call === "object" &&
    call !== null &&
    "method" in call &&
    typeof call.method === "string"
      ? call.method
      : "?";
  console.log(
    `⏳ pending  ${short(hash)}  ${method}  from ${short(str(d.from))}`
  );
});

// Confirmed trade frame. Match it back to a pending tx if we saw one.
// Confirmed trade payloads don't carry the tx hash, so we reconcile on the
// hashes we cached; in practice you'd correlate via your own indexer too.
radion.realtime.onChannel("trading", (e) => {
  if (pendingSeen.size === 0) {
    return;
  }
  console.log(
    `✅ confirmed trade  ${e.data.type}  (pending pool size ${pendingSeen.size})`
  );
});

radion.realtime.subscribe({ channel: "mempool.trading", id: "pending" });
radion.realtime.subscribe({ channel: "trading", id: "confirmed" });
await radion.realtime.connect();
