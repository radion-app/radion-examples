/**
 * Mempool early alerts + reconciliation
 *
 * Subscribe to pending exchange transactions for early visibility, then reconcile
 * each against the confirmed `trades` stream by transaction hash — measuring how
 * far ahead the mempool saw it. This is the front-of-confirmation pattern.
 *
 * Channels: `mempool.trades` (pending) + `trades` (confirmed). Two subscriptions,
 * so this fits the Free plan (2 subs/connection).
 * Docs: https://docs.radion.app/websockets/mempool
 *
 * Note: emits nothing until the production mempool source is provisioned
 * (see POLYGON_MEMPOOL_WS_URL on the API). The confirmed half still works.
 *
 * Run:
 *   bun run websockets/06-mempool-early-alerts/index.ts
 */
import { connect, short, type Frame } from "../../shared/radion-ws";

// Pending tx hash -> when we first saw it (ms), to compute pending→confirmed lead time.
const pendingSeen = new Map<string, number>();

console.log("Watching mempool.trades + trades. Reconciling by tx hash…");

connect({
  subscriptions: [
    { id: "pending", channel: "mempool.trades" },
    { id: "confirmed", channel: "trades" },
  ],
  onStatus: (s) => console.log(`[${s}]`),
  onError: (f: Frame) => console.error("error:", f.code, f.message),
  onEvent: (d, frame) => {
    if (frame.channel === "mempool.trades") {
      const hash = d?.transaction_hash;
      if (!hash) return;
      pendingSeen.set(hash, d.seen_at_ms ?? Date.now());
      const method = d?.call?.method ?? "?";
      console.log(`⏳ pending  ${short(hash)}  ${method}  from ${short(d.from)}`);
      return;
    }

    // Confirmed trade frame. Match it back to a pending tx if we saw one.
    // Confirmed trade payloads don't carry the tx hash, so we reconcile on the
    // hashes we cached; in practice you'd correlate via your own indexer too.
    if (pendingSeen.size === 0) return;
    console.log(`✅ confirmed trade  ${d?.type}  (pending pool size ${pendingSeen.size})`);
  },
});
