# Agent Loom — MCP Server

Express server implementing **Model Context Protocol** over **Streamable HTTP**. Loads tool and workflow definitions from **PostgreSQL** (same `DATABASE_URL` as the web app). OAuth **authorization** happens on the web app; this service validates **bearer tokens** and exposes **protected-resource metadata** for MCP clients.

## Features

- **Streamable HTTP** — `POST /mcp/:slug` for MCP session + JSON-RPC
- **OAuth discovery** — `/.well-known/oauth-*` and `/mcp/:slug/.well-known/*` (issuer / token / registration URLs point at `WEB_APP_URL`)
- **Slug routing** — One row per MCP server in `mcp_servers`; tools from `mcp_server_tools` + proxies; workflows from `mcp_server_workflows`
- **CORS** — Enabled for browser-based OAuth flows where needed

## Environment

| Variable | Description |
|----------|-------------|
| **`DATABASE_URL`** | **Required** — same Postgres as web app (`/health` shows `databaseConfigured`) |
| **`WEB_APP_URL`** | Web app origin for OAuth metadata (e.g. `https://your-app.vercel.app`) |
| **`MCP_PUBLIC_URL`** | Public URL of **this** service (e.g. `https://your-mcp.onrender.com`). Used in `WWW-Authenticate` and resource metadata |
| `PORT` / `MCP_SERVER_PORT` | Listen port (Render often sets `PORT`) |
| `MCP_SERVER_BASE_URL` | Fallback when `MCP_PUBLIC_URL` unset (local dev) |

Unauthenticated requests to `/mcp/:slug` return **401** with `authorization_url` on the web app — expected when opening the URL in a browser without a token.

## Running

```bash
pnpm dev       # tsx watch, default port 3001
pnpm start     # production-style start
```

Ensure `DATABASE_URL` and `WEB_APP_URL` are set before accepting real MCP clients.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `ok`, `databaseConfigured` |
| `POST` | `/mcp/:slug` | MCP (new or existing session via `mcp-session-id`) |
| `GET` / `DELETE` | `/mcp/:slug` | Session continuation / teardown (requires session id) |
| `GET` | `/.well-known/oauth-authorization-server` | OAuth AS metadata |
| `GET` | `/.well-known/oauth-protected-resource` | Resource metadata |
| `GET` | `/mcp/:slug/.well-known/oauth-*` | Slug-scoped metadata |

## Local testing with a tunnel

Expose MCP for external clients (e.g. Claude):

```bash
cloudflared tunnel --url http://localhost:3001
```

Set `MCP_PUBLIC_URL` to the tunnel URL for accurate metadata.

## Layout

```
src/
├── index.ts          # Entry: WEB_APP_URL, MCP_PUBLIC_URL, listen
├── server.ts         # Express, CORS, MCP transport, OAuth routes
├── auth/             # Bearer validation
├── tools/            # Registry, proxy/workflow/Soroswap/stellar tools
└── db.ts             # Postgres client
```

See the **[root README](../../README.md)** for deployment (Vercel + Render) and **`NEXT_PUBLIC_MCP_URL`** on the web app.
