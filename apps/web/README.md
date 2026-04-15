# Agent Loom — Web App

Next.js app: Stellar wallet auth, x402 API proxies, workflow builder, MCP server management, and **OAuth 2.1** for MCP clients.

## Features

- **Wallet authentication** — Stellar (Wallets Kit) + session cookies (iron-session)
- **API proxies** — x402-stellar pricing, settlement, optional legacy memo 402
- **Workflows** — Create, test, and run multi-step definitions (`packages/workflow`)
- **MCP servers** — Slugs, tools (proxies), workflows; connection URL uses **`NEXT_PUBLIC_MCP_URL`**
- **OAuth** — Authorization code + PKCE; tokens scoped for MCP and Stellar tools

## Environment setup

1. Copy root example and wire web + shared vars (or maintain `apps/web/.env.local`):

   ```bash
   cp ../../.env.example ../../.env
   ```

2. Important variables:

 | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | PostgreSQL (shared with MCP server) |
   | `REDIS_URL` | Redis (if used for rate limits / cache) |
   | `NEXT_PUBLIC_APP_URL` | Public web origin (e.g. `https://your-app.vercel.app`) |
   | **`NEXT_PUBLIC_MCP_URL`** | **Public MCP server origin** (not Vercel). Dashboard shows `{NEXT_PUBLIC_MCP_URL}/mcp/{slug}` |
   | `STELLAR_NETWORK` | `testnet` or `public` |
   | `STELLAR_RPC_URL` / `STELLAR_HORIZON_URL` | Soroban + Horizon endpoints |
   | `APP_SESSION_SECRET` | ≥32 chars (iron-session) |
   | `SESSION_SECRET` / `ENCRYPTION_SECRET` | As required by auth helpers |
   | `WORKFLOW_HOT_WALLET_SECRET` | Optional; for Soroban “hot” signer + Soroswap server path |
   | `X402_*` | Facilitator URL / API key for x402 |

3. Database migrations / push (use scripts from this package if defined, e.g. `pnpm db:push`).

## Running

```bash
pnpm dev      # http://localhost:3000
pnpm build && pnpm start
```

## Project structure

```
app/ # App Router: pages, API routes, oauth
features/      # Proxies, workflows, MCP UI, auth
lib/           # Stellar, x402, db, validations
components/    # Shared UI
```

See the **[root README](../../README.md)** for architecture and production deployment notes.
