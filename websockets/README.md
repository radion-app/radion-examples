# WebSocket Examples

Real use cases built on the Radion WebSocket (`wss://api.radion.app/ws`). Each example is a single Node.js + TypeScript file driven by one or two channel subscriptions, built on the realtime client from [`@radion-app/sdk`](https://github.com/radion-app/radion-typescript).

## Use cases

| Channel | Filter | Example |
| --- | --- | --- |
| `trading` | `wallets` | [01 Copytrading mirror](./01-copytrading-mirror/) |
| `wallets` | `wallets` (req) | [02 Wallet alerts](./02-wallet-alerts/) |
| `trading` | `min_usd` | [03 Whale trade feed](./03-whale-trade-feed/) |
| `clob.prices` | `token_ids` (req) | [04 Live price ticker](./04-live-price-ticker/) |
| `markets` | `market_ids`/`token_ids` | [05 Single-market monitor](./05-market-monitor/) |
| `mempool.trading` + `trading` | — | [06 Mempool early alerts](./06-mempool-early-alerts/) |
| `resolution` | — | [07 Resolution watcher](./07-resolution-watcher/) |
| `trading` | — | [08 Resilient client](./08-resilient-client/) |

## Examples

### 01 — Copytrading mirror · `trading` (wallets filter)

Follow trader wallets; when a watched address fills an order, print the trade you'd mirror. The live counterpart to a copytrading backtest.

```bash
pnpm run copytrade 0xWALLET [0xWALLET...]
```

### 02 — Wallet alerts · `wallets` (wallets filter)

Alert on **any** activity for watched addresses — trades, transfers, redemptions, splits, merges.

```bash
pnpm run wallet-alerts 0xWALLET [0xWALLET...]
```

### 03 — Whale trade feed · `trading` (min_usd)

Rolling leaderboard of the biggest fills above a USD threshold.

```bash
pnpm run whales [minUsd=10000]
```

### 04 — Live price ticker · `clob.prices` (token_ids)

Continuously-updating price per token from the CLOB price feed (`clob.prices`), with move direction. Requires at least one token id.

```bash
pnpm run ticker 0xTOKEN [0xTOKEN...]
```

### 05 — Single-market monitor · `markets` (market_ids/token_ids)

Everything happening on one market — fills, splits, merges, redemptions — with a per-type tally.

```bash
pnpm run market --market 0xCONDITION_ID
pnpm run market --token  0xTOKEN_ID
```

### 06 — Mempool early alerts · `mempool.trading` + `trading`

Pending exchange transactions for early visibility, reconciled against confirmed trades by tx hash. Two subscriptions (fits the Free plan).

```bash
pnpm run mempool
```

### 07 — Resolution watcher · `resolution`

Print the instant a market's outcome is reported or resolved (settlement events).

```bash
pnpm run resolutions
```

### 08 — Resilient client · `@radion-app/sdk`

A production-shaped connection: `X-API-Key` upgrade, exponential-backoff reconnect, resubscribe-on-reconnect, app-level ping, and `lagged` / `key_revoked` handling. This is the realtime client from [`@radion-app/sdk`](https://github.com/radion-app/radion-typescript) that every other example builds on, demonstrated standalone.

```bash
pnpm run resilient
```

## Reference

[Overview](https://docs.radion.app/websockets/overview) · [Subscribe](https://docs.radion.app/websockets/subscribe) · [Frames](https://docs.radion.app/websockets/frames) · [Channels](https://docs.radion.app/websockets/channels/overview) · [Filters](https://docs.radion.app/websockets/filters) · [Mempool](https://docs.radion.app/websockets/mempool) · [Connection state](https://docs.radion.app/websockets/connection-state)
