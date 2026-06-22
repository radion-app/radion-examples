/**
 * Resilient Radion WebSocket client.
 *
 * One small helper every example builds on. It handles the parts you'd otherwise
 * rewrite each time:
 *   - opens the socket with the `X-API-Key` upgrade header (never in the URL),
 *   - reconnects with exponential backoff,
 *   - re-sends your subscriptions after every reconnect,
 *   - sends an application-level ping on an interval,
 *   - routes incoming frames to `onEvent` / `onControl` / `onError`,
 *   - reconnects on a `lagged` error and stops on `key_revoked` / `revalidation_failed`.
 *
 * Docs: https://docs.radion.app/websockets/overview
 */

export type Filters = {
  wallets?: string[];
  market_ids?: string[];
  token_ids?: string[];
  min_usd?: number;
};

export type Subscription = {
  /** Client-defined id, echoed back on confirmations and event frames. */
  id: string;
  channel: string;
  filters?: Filters;
};

export type Frame = {
  type: string;
  id?: string;
  channel?: string;
  data?: any;
  code?: string;
  message?: string;
  skipped?: number;
};

export type Status =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "fatal";

export type ConnectOptions = {
  /** One or more subscriptions, re-sent automatically on reconnect. */
  subscriptions: Subscription[];
  /** Called for every `event` frame with the decoded `data` payload. */
  onEvent: (data: any, frame: Frame) => void;
  /** Optional: control frames (`subscribed`, `unsubscribed`, `pong`). */
  onControl?: (frame: Frame) => void;
  /** Optional: error frames (`unknown_channel`, `lagged`, `subscription_limit`, ...). */
  onError?: (frame: Frame) => void;
  /** Optional: connection lifecycle updates. */
  onStatus?: (status: Status, detail?: string) => void;
  url?: string;
  apiKey?: string;
  /** Application-level ping cadence; 0 disables. Default 30s. */
  pingIntervalMs?: number;
};

export type RadionClient = {
  subscribe: (sub: Subscription) => void;
  unsubscribe: (id: string) => void;
  close: () => void;
};

const MIN_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const FATAL_CODES = new Set(["key_revoked", "revalidation_failed"]);

export function connect(opts: ConnectOptions): RadionClient {
  const url = opts.url ?? process.env.RADION_WS ?? "wss://api.radion.app/ws";
  const apiKey = opts.apiKey ?? process.env.RADION_API_KEY;
  const pingIntervalMs = opts.pingIntervalMs ?? 30_000;

  if (!apiKey) {
    throw new Error(
      "Missing RADION_API_KEY. Copy .env.example to .env and set your key (https://radion.app).",
    );
  }

  // Live subscription set, keyed by id, so reconnects replay the current state.
  const subs = new Map<string, Subscription>();
  for (const s of opts.subscriptions) subs.set(s.id, s);

  let ws: WebSocket | null = null;
  let backoff = MIN_BACKOFF_MS;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const status = (s: Status, detail?: string) => opts.onStatus?.(s, detail);

  const send = (msg: unknown) => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  const open = () => {
    status(backoff === MIN_BACKOFF_MS ? "connecting" : "reconnecting");
    // Bun's native WebSocket accepts custom upgrade headers.
    ws = new WebSocket(url, { headers: { "X-API-Key": apiKey } } as any);

    ws.addEventListener("open", () => {
      backoff = MIN_BACKOFF_MS;
      status("open");
      for (const sub of subs.values()) {
        send({ action: "subscribe", id: sub.id, channel: sub.channel, ...(sub.filters ? { filters: sub.filters } : {}) });
      }
      if (pingIntervalMs > 0) {
        pingTimer = setInterval(() => send({ action: "ping" }), pingIntervalMs);
      }
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      let frame: Frame;
      try {
        frame = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (frame.type) {
        case "event":
          opts.onEvent(frame.data, frame);
          break;
        case "error":
          opts.onError?.(frame);
          if (frame.code && FATAL_CODES.has(frame.code)) {
            status("fatal", frame.code);
            stopped = true;
            cleanup();
            ws?.close();
          } else if (frame.code === "lagged") {
            // Fell behind the buffer; reconnect to resume cleanly.
            ws?.close();
          }
          break;
        default:
          opts.onControl?.(frame);
      }
    });

    ws.addEventListener("close", () => {
      cleanup();
      if (stopped) {
        status("closed");
        return;
      }
      status("reconnecting", `retry in ${backoff}ms`);
      setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    });

    ws.addEventListener("error", () => {
      // `close` fires next and drives the reconnect; nothing to do here.
    });
  };

  const cleanup = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  open();

  return {
    subscribe(sub) {
      subs.set(sub.id, sub);
      send({ action: "subscribe", id: sub.id, channel: sub.channel, ...(sub.filters ? { filters: sub.filters } : {}) });
    },
    unsubscribe(id) {
      subs.delete(id);
      send({ action: "unsubscribe", id });
    },
    close() {
      stopped = true;
      cleanup();
      ws?.close();
    },
  };
}

/** Polymarket amounts arrive as hex strings. Convert to a USDC float (6 decimals). */
export function hexToUsdc(hex?: string): number {
  if (!hex) return 0;
  try {
    return Number(BigInt(hex)) / 1e6;
  } catch {
    return 0;
  }
}

/** Shorten a hex address/hash for display: 0x1234…abcd */
export function short(hex?: string): string {
  if (!hex || hex.length < 12) return hex ?? "";
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`;
}
