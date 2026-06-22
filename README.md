# Radion Examples

Real-world, runnable examples showing how to build on **[Radion](https://radion.app)** — live Polymarket onchain data, trader activity, market lifecycle, and price ticks over a single WebSocket.

Built with **[Bun](https://bun.sh)** and TypeScript. No runtime dependencies — Bun's native `WebSocket` supports the `X-API-Key` upgrade header, so every example is a single file you can run directly.

```bash
git clone https://github.com/radion-app/radion-examples
cd radion-examples
cp .env.example .env        # set RADION_API_KEY=rk_...
bun install                 # dev types only
bun run copytrade -- 0xWALLET
```

## What's here

| Area       | Folder                         | Examples                                                                                                            |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| WebSockets | [`websockets/`](./websockets/) | Copytrading, wallet alerts, whale feed, price ticker, market monitor, mempool, resolution watcher, resilient client |

The REST API can get its own top-level folder later.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.4 — `curl -fsSL https://bun.sh/install | bash`
- A Radion API key (prefix `rk_`) — get one at [radion.app](https://radion.app). See [WebSocket auth](https://docs.radion.app/websockets/authentication).

## Setup

```bash
cp .env.example .env
# edit .env, set RADION_API_KEY=rk_...
bun install
```

Bun auto-loads `.env`, so examples read `process.env.RADION_API_KEY` with no extra config.

## Run an example

Each example is a single file. Pass arguments after `--` when using the npm-style scripts:

```bash
bun run websockets/01-copytrading-mirror/index.ts 0xWALLET
# or
bun run copytrade -- 0xWALLET
```

| Script                  | Example               | Args                          |
| ----------------------- | --------------------- | ----------------------------- |
| `bun run copytrade`     | Copytrading mirror    | `0xWALLET…`                   |
| `bun run wallet-alerts` | Wallet alerts         | `0xWALLET…`                   |
| `bun run whales`        | Whale trade feed      | `[minUsd]`                    |
| `bun run ticker`        | Live price ticker     | `[0xTOKEN…]`                  |
| `bun run market`        | Single-market monitor | `--market 0x… \| --token 0x…` |
| `bun run mempool`       | Mempool early alerts  | —                             |
| `bun run resolutions`   | Resolution watcher    | —                             |
| `bun run resilient`     | Resilient client      | —                             |

## Endpoints used

|               |                                             |
| ------------- | ------------------------------------------- |
| WebSocket     | `wss://api.radion.app/ws`                   |
| Health        | `GET https://api.radion.app/health`         |
| Documentation | https://docs.radion.app/websockets/overview |

## Repo layout

```
radion-examples/
├── README.md
├── .env.example           # RADION_API_KEY, RADION_WS, RADION_HTTP
├── package.json           # bun scripts (one per example)
├── tsconfig.json
├── shared/
│   └── radion-ws.ts       # resilient client: connect + auth + backoff + resubscribe
└── websockets/
    ├── README.md          # channel → use-case map + per-example index
    ├── 01-copytrading-mirror/
    ├── 02-wallet-alerts/
    ├── 03-whale-trade-feed/
    ├── 04-live-price-ticker/
    ├── 05-market-monitor/
    ├── 06-mempool-early-alerts/
    ├── 07-resolution-watcher/
    └── 08-resilient-client/
```
