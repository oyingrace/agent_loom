# Phase 6 MCP Smoke Test

This is a repeatable end-to-end script for validating the `agent_loom` **Phase 6 (MCP parity)** path:

1. Authenticate to the web app using wallet signature auth (`GET /api/auth/nonce` + `POST /api/auth/session`).
2. Seed Postgres with:
   - `mcp_servers`
   - `api_proxies`
   - `mcp_server_tools` (proxy tools)
   - `workflow_templates`
   - `mcp_server_workflows` (workflow tools)
3. Perform OAuth authorization-code + PKCE (`/api/oauth/register`, `/api/oauth/authorize`, `/api/oauth/token`) to obtain a bearer token.
4. Connect to `apps/mcp-server` via the MCP TypeScript SDK and verify:
   - tool discovery (`listTools()`)
   - workflow tool invocation (dry-run)
   - proxy tool invocation returns the expected payment-related error (proves proxy 402 + `X-PAYMENT` handling; smoke uses legacy `x_payment` shape)

## Run

From repo root (`agent_loom/`):

```bash
pnpm tsx tooling/phase6-mcp-smoke.ts
```

## Prerequisites

You must have:

- Web app running: `apps/web` (default `WEB_APP_URL=http://localhost:3000`)
- MCP server running: `apps/mcp-server` (default `MCP_SERVER_URL=http://localhost:3001`)
- Postgres configured: `DATABASE_URL`
- Redis configured (used by paid proxy nonce verification): `REDIS_URL`
- `APP_SESSION_SECRET` (or `SESSION_SECRET`) configured for iron-session

## Output / What PASS means

The script ends with:

- `Phase 6 MCP smoke test: PASS`

If it fails, the error usually points to one of:

- OAuth/session issues (`/api/auth/*` or `/api/oauth/*`)
- MCP tool registry queries (DB joins / tool naming)
- Streamable HTTP connection (`POST /mcp/:slug` JSON-RPC handshake)
- Proxy tool / gateway (`X-PAYMENT` legacy JSON or x402 base64 in `/api/proxy/:id`)

