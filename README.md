# Radion Examples

Real-world, runnable examples showing how to build on **[Radion](https://radion.app)** — live Polymarket onchain data, trader activity, market lifecycle, and live CLOB prices over a single WebSocket.

Built with **[Node.js](https://nodejs.org)** and TypeScript on top of the **[`@radion-app/sdk`](https://github.com/radion-app/radion-typescript)** package — connection, reconnect, heartbeat and resubscribe are handled by the SDK, so every example is a single focused file you can run directly. TypeScript runs through [`tsx`](https://tsx.is) with no build step.

```bash
git clone https://github.com/radion-app/radion-examples
cd radion-examples
cp .env.example .env        # set RADION_API_KEY=rk_...
pnpm install                # @radion-app/sdk + tsx + dev types
pnpm run copytrade 0xWALLET
```

## What's here

| Area | Folder | Examples |
| --- | --- | --- |
| WebSockets | [`websockets/`](./websockets/) | Copytrading, wallet alerts, whale feed, price ticker, market monitor, mempool, resolution watcher, resilient client |

The REST API can get its own top-level folder later.

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 22 and [pnpm](https://pnpm.io) ≥ 9
- A Radion API key (prefix `rk_`) — get one at [radion.app](https://radion.app). See [WebSocket auth](https://docs.radion.app/websockets/authentication).

## Setup

```bash
cp .env.example .env
# edit .env, set RADION_API_KEY=rk_...
pnpm install
```

The scripts pass `--env-file-if-exists=.env` to Node, so examples read `process.env.RADION_API_KEY` from `.env` with no extra config.

## Run an example

Each example is a single file. Use the named scripts, or run a file directly with `tsx`:

```bash
pnpm run copytrade 0xWALLET
# or run the file directly
tsx --env-file-if-exists=.env websockets/01-copytrading-mirror/index.ts 0xWALLET
```

| Script | Example | Args |
| --- | --- | --- |
| `pnpm run copytrade` | Copytrading mirror | `0xWALLET…` |
| `pnpm run wallet-alerts` | Wallet alerts | `0xWALLET…` |
| `pnpm run whales` | Whale trade feed | `[minUsd]` |
| `pnpm run ticker` | Live price ticker | `[0xTOKEN…]` |
| `pnpm run market` | Single-market monitor | `--market 0x… \| --token 0x…` |
| `pnpm run mempool` | Mempool early alerts | — |
| `pnpm run resolutions` | Resolution watcher | — |
| `pnpm run resilient` | Resilient client | — |

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
├── package.json           # pnpm/tsx scripts (one per example)
├── tsconfig.json
├── shared/
│   └── utils.ts           # display helpers + lifecycle logging on top of @radion-app/sdk
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
