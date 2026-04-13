# Phase 6 — MCP server parity

The `apps/mcp-server` service mirrors `agent_fabric`’s MCP pattern: an Express app exposes Streamable HTTP MCP endpoints, validates OAuth bearer tokens against the same PostgreSQL tables as the web app, and registers tools from `mcp_servers` / `mcp_server_tools` that invoke paid API proxies via `POST/GET` to `{WEB_APP_URL}/api/proxy/{id}` with an optional **`X-PAYMENT`** header: **Stellar x402** (base64 `PaymentPayload` via tool arg `x402_header`) or **legacy** JSON `{ txHash, paymentNonce }` (tool arg `x_payment`). See `docs/PHASE_5_PAID_PROXY.md`.

## Configuration

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Required for token and tool metadata queries. |
| `MCP_SERVER_PORT` | Listen port (default `3001`). |
| `WEB_APP_URL` | Origin of the Next app (`http://localhost:3000`). Used in OAuth metadata (`authorization_endpoint` → `/oauth/authorize` consent page; JSON API remains `GET/POST /api/oauth/authorize`) and proxy tool `fetch` targets. Falls back to `NEXT_PUBLIC_APP_URL`. |
| `MCP_PUBLIC_URL` | Optional public base URL of this MCP server for RFC 9470 resource metadata. If unset, derived from `Host` / `X-Forwarded-*`. |
| `MCP_SERVER_BASE_URL` | Optional fallback when `MCP_PUBLIC_URL` is empty (e.g. local `http://localhost:3001`). |

## Endpoints

- `GET /health` — Liveness; includes `databaseConfigured`.
- `GET /.well-known/oauth-authorization-server` — RFC 8414 metadata; `authorization_endpoint` is `{WEB_APP_URL}/oauth/authorize` (Fabric-style consent UI; API handlers stay under `/api/oauth/authorize`).
- `GET /.well-known/oauth-authorization-server/*path` — Path-based discovery (e.g. `.../mcp/my-slug`).
- `GET /.well-known/oauth-protected-resource` — RFC 9470 global resource metadata.
- `GET /mcp/:slug/.well-known/oauth-authorization-server` — Slug-scoped OAuth metadata with `mcp_slug` query hints.
- `GET /mcp/:slug/.well-known/oauth-protected-resource` — Slug-scoped protected resource metadata.
- `POST /mcp/:slug` — Initialize or continue an MCP session (JSON-RPC over Streamable HTTP). Requires `Authorization: Bearer` for new sessions; `mcp-session-id` for subsequent requests on the same transport.
- `GET` / `DELETE /mcp/:slug` — Session continuation / teardown per MCP Streamable HTTP semantics.

## Tool behavior (proxy tools)

Arguments are **optional** on the first call so the client can receive **402** and read `accepts` / payment instructions.

| Argument | When to use |
|----------|-------------|
| `x402_header` | Base64-encoded x402 `PaymentPayload` for `X-PAYMENT` (preferred for new agents). |
| `x_payment` | Legacy: `{ txHash, paymentNonce }` after a Horizon memo payment. |

Do not send both. Additional JSON keys are forwarded as the POST body to the proxy; if there is no body and no payment args, the proxy is called with `GET`.

On **402**, the tool returns the parsed JSON body (including `accepts`) so the client can build `x402_header` and retry.

## Running locally

From the repo root, with Postgres migrated and env vars set:

```bash
pnpm --filter @agent-loom/mcp-server dev
```

Point an MCP client at `http://localhost:3001/mcp/<your-mcp-server-slug>` with a valid OAuth access token issued by the web app’s token endpoint.
