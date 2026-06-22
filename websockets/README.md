# WebSocket Examples

Real use cases built on the Radion WebSocket (`wss://api.radion.app/ws`). Each example is a single Bun file driven by one or two channel subscriptions, built on the shared [`connect()`](../shared/radion-ws.ts) client.

## Channel → use-case map

| Channel                     | Filter                   | Example                                               |
| --------------------------- | ------------------------ | ----------------------------------------------------- |
| `trades`                    | `wallets`                | [01 Copytrading mirror](./01-copytrading-mirror/)     |
| `wallets`                   | `wallets` (req)          | [02 Wallet alerts](./02-wallet-alerts/)               |
| `large_trades`              | `min_usd`                | [03 Whale trade feed](./03-whale-trade-feed/)         |
| `prices`                    | `token_ids`              | [04 Live price ticker](./04-live-price-ticker/)       |
| `markets`                   | `market_ids`/`token_ids` | [05 Single-market monitor](./05-market-monitor/)      |
| `mempool.trades` + `trades` | —                        | [06 Mempool early alerts](./06-mempool-early-alerts/) |
| `oracle`                    | —                        | [07 Resolution watcher](./07-resolution-watcher/)     |
| `global`                    | —                        | [08 Resilient client](./08-resilient-client/)         |

## Examples

### 01 — Copytrading mirror · `trades` (wallets filter)

Follow trader wallets; when a watched address fills an order, print the trade you'd mirror. The live counterpart to a copytrading backtest.

```bash
bun run 01-copytrading-mirror/index.ts 0xWALLET [0xWALLET...]
```

### 02 — Wallet alerts · `wallets` (wallets filter)

Alert on **any** activity for watched addresses — trades, transfers, redemptions, splits, merges.

```bash
bun run 02-wallet-alerts/index.ts 0xWALLET [0xWALLET...]
```

### 03 — Whale trade feed · `large_trades` (min_usd)

Rolling leaderboard of the biggest fills above a USD threshold.

```bash
bun run 03-whale-trade-feed/index.ts [minUsd=10000]
```

### 04 — Live price ticker · `prices` (token_ids)

Continuously-updating last-traded price per token, with move direction.

```bash
bun run 04-live-price-ticker/index.ts [0xTOKEN...]
```

### 05 — Single-market monitor · `markets` (market_ids/token_ids)

Everything happening on one market — fills, splits, merges, redemptions — with a per-type tally.

```bash
bun run 05-market-monitor/index.ts --market 0xCONDITION_ID
bun run 05-market-monitor/index.ts --token  0xTOKEN_ID
```

### 06 — Mempool early alerts · `mempool.trades` + `trades`

Pending exchange transactions for early visibility, reconciled against confirmed trades by tx hash. Two subscriptions (fits the Free plan). _Quiet until the production mempool source is provisioned._

```bash
bun run 06-mempool-early-alerts/index.ts
```

### 07 — Resolution watcher · `oracle`

Print the instant a market's outcome is proposed or resolved (UMA oracle lifecycle).

```bash
bun run 07-resolution-watcher/index.ts
```

### 08 — Resilient client · shared helper

A production-shaped connection: `X-API-Key` upgrade, exponential-backoff reconnect, resubscribe-on-reconnect, app-level ping, and `lagged` / `key_revoked` handling. This is the [`shared/radion-ws.ts`](../shared/radion-ws.ts) helper every other example imports, demonstrated standalone.

```bash
bun run 08-resilient-client/index.ts
```

## Reference

[Overview](https://docs.radion.app/websockets/overview) · [Subscribe](https://docs.radion.app/websockets/subscribe) · [Frames](https://docs.radion.app/websockets/frames) · [Channels](https://docs.radion.app/websockets/channels/overview) · [Filters](https://docs.radion.app/websockets/filters) · [Mempool](https://docs.radion.app/websockets/mempool) · [Connection state](https://docs.radion.app/websockets/connection-state)

Free plan = 1 connection / 2 subscriptions. Every example here uses at most 2 subscriptions.
