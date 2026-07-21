/**
 * Webhook receiver
 *
 * A minimal HTTP server for Radion webhook deliveries. Each POST is
 * authenticated with `verifyWebhookSignature` (HMAC over the raw body bytes),
 * parsed into a typed event with `parseWebhookEvent`, acknowledged fast with a
 * 2xx, and deduplicated on `(id, seq)` — retries can deliver an event twice.
 *
 * Create a webhook endpoint in the dashboard pointing at a public https URL
 * for this server (use a tunnel like `cloudflared` or `ngrok` in dev).
 * Docs: https://docs.radion.app/webhooks/overview
 *
 * Run:
 *   tsx --env-file-if-exists=.env webhooks/01-webhook-receiver/index.ts [port]
 */
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import { parseWebhookEvent, verifyWebhookSignature } from "@radion-app/sdk";
import type { WebhookEvent } from "@radion-app/sdk";

const secret = process.env.RADION_WEBHOOK_SECRET;
if (secret === undefined || secret === "") {
  throw new Error(
    "Missing RADION_WEBHOOK_SECRET. Copy the endpoint's whsec_… secret from the dashboard (https://radion.app/dashboard) into .env."
  );
}

const port = Number(process.argv[2] ?? 8787);

// Retries can deliver an event more than once — remember recent (id, seq) pairs.
const MAX_SEEN = 10_000;
const seen = new Set<string>();

const headerValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

/** Collect the raw body as bytes — the signature covers them exactly. */
const readBody = async (request: IncomingMessage): Promise<Buffer> => {
  const stream: AsyncIterable<Buffer> = request;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const logEvent = (event: WebhookEvent): void => {
  const key = `${event.id}:${event.seq}`;
  if (seen.has(key)) {
    return;
  }
  if (seen.size >= MAX_SEEN) {
    seen.clear();
  }
  seen.add(key);

  const time = new Date().toISOString().slice(11, 19);
  const feed = event.confirmed === false ? "pending" : "confirmed";
  const kind = "type" in event.data ? String(event.data.type) : event.channel;
  console.log(
    `📬 ${time}  ${event.channel} (${feed}) seq=${event.seq}  ${kind}`
  );
};

const deliver = async (
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> => {
  if (request.method !== "POST") {
    response.writeHead(405).end();
    return;
  }

  const body = await readBody(request);
  const authentic = await verifyWebhookSignature({
    payload: body,
    secret,
    signature: headerValue(request.headers["x-radion-signature"]),
    timestamp: headerValue(request.headers["x-radion-timestamp"]),
  });
  if (!authentic) {
    response.writeHead(401).end();
    return;
  }

  const event = parseWebhookEvent(body.toString("utf-8"));
  if (!event) {
    response.writeHead(422).end();
    return;
  }

  // Ack before any real work: a slow handler hits the 10s delivery timeout and triggers retries.
  response.writeHead(200).end("ok");
  logEvent(event);
};

const handleDelivery = async (
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> => {
  try {
    await deliver(request, response);
  } catch (error) {
    console.error("delivery failed:", error);
    response.writeHead(500).end();
  }
};

const server = createServer((request, response) => {
  void handleDelivery(request, response);
});

server.listen(port, () => {
  console.log(
    `Listening on http://localhost:${port} — point a webhook endpoint here via a public https tunnel.`
  );
});
