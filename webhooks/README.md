# Webhook examples

Radion [webhooks](https://docs.radion.app/webhooks/overview) POST the same event frames as the WebSocket, signed with your endpoint's secret.

These examples consume them with the SDK's webhook helpers (`@radion-app/sdk` v0.8.0+):
- `verifyWebhookSignature` authenticates each delivery
- `parseWebhookEvent` validates the body into the same typed events the realtime client emits

Both are runtime-agnostic (WebCrypto) — the receiver here runs on plain `node:http`, but the same two calls work in a serverless function or edge runtime.

## Setup

1. Start the receiver: `pnpm run webhook-receiver` (default port 8787).
2. Expose it on a public https URL: `cloudflared tunnel --url http://localhost:8787` or `ngrok http 8787`.
3. Create a webhook endpoint in the [dashboard](https://radion.app/dashboard) pointing at the tunnel URL, pick channels and filters, and copy its `whsec_…` secret into `.env` as `RADION_WEBHOOK_SECRET`.

## Examples

| Example | What it shows |
| --- | --- |
| [`01-webhook-receiver`](./01-webhook-receiver/) | Verify the HMAC signature over the raw body bytes, parse into a typed event, ack fast with a 2xx, dedupe on `(id, seq)`. |
