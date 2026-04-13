# Stellar trending worker

Cloudflare Worker that returns `{ "tokens": [...] }` for Agent Loom’s `STELLAR_TRENDING_API_URL`.

## Configure Loom

In `agent_loom/.env`:

```bash
STELLAR_TRENDING_API_URL=https://<your-worker-host>/trending?network={network}&limit={limit}
```

Loom replaces `{network}` with `testnet` or `public` and `{limit}` with the requested count.

## How rankings work

1. **`TRENDING_JSON` (optional Cloudflare var)**  
   If set and non-empty, the worker returns that list and **does not** call Horizon. Use this for hand-curated or ETL-produced rankings.

2. **Mainnet (`network=mainnet` or `network=public`)**  
   If `TRENDING_JSON` is unset, the worker fetches **recent trades** from [Horizon](https://horizon.stellar.org/) (`/trades?order=desc&limit=200`), counts how often each **classic** asset (`credit_alphanum4` / `credit_alphanum12`) appears, takes the top `limit`, and converts each to a **Stellar Asset Contract** id (`C...`) via `@stellar/stellar-base` — the same SAC addresses DEXes use for that asset.

   This is **not** “24h volume from CoinGecko”; it is a **live, explainable** signal: *most frequently traded assets in the latest batch of Horizon trades*.

3. **Testnet**  
   Same Horizon logic against `horizon-testnet`; if that returns no rows, the worker falls back to a small curated list.

**Optional env:** `HORIZON_URL` — override the Horizon base (e.g. private mirror).

**Wrangler:** `nodejs_compat` is enabled for `stellar-base`.

## Local dev

This package is **not** in the root `pnpm-workspace.yaml`. Install inside this folder:

```bash
cd workers/stellar-trending
pnpm install   # or: npm install
pnpm dev
```

## Deploy

```bash
pnpm run deploy
```

(`pnpm deploy` alone is a different pnpm command — use `pnpm run deploy` or `npx wrangler deploy`.)

## Curated override example (dashboard → Variables)

```json
[
  { "rank": 1, "symbol": "USDC", "contract": "C..." },
  { "rank": 2, "symbol": "EURC", "contract": "C..." }
]
```

Paste as **`TRENDING_JSON`** when you want full control and no Horizon calls.
