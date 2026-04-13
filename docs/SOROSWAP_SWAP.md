# Soroswap AMM direct swap (MCP + API)

**Choice:** **AMM direct** via Soroswap **router** `swap_exact_tokens_for_tokens` (not the HTTP quote API, not the aggregator in v1).

**Locked router IDs** (override with `SOROSWAP_ROUTER_TESTNET` / `SOROSWAP_ROUTER_MAINNET`):

| Network | Router (default) | Source |
|---------|------------------|--------|
| Testnet | `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD` | [testnet.contracts.json](https://github.com/soroswap/core/blob/main/public/testnet.contracts.json) |
| Mainnet | `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` | [mainnet.contracts.json](https://github.com/soroswap/core/blob/main/public/mainnet.contracts.json) |

Docs: [Soroswap deployed addresses](https://docs.soroswap.finance/smart-contracts/01-protocol-overview/03-technical-reference/deployed-addresses).

## Requirements

- `STELLAR_RPC_URL` and `STELLAR_HORIZON_URL` for the **same** network (`STELLAR_NETWORK=testnet` or `public`).
- `WORKFLOW_HOT_WALLET_SECRET` — signs the Soroban tx (same as live workflow Soroban).
- Hot wallet holds **input** token balance and has **approved** the Soroswap router on that token (SEP-41 `approve` / allowance). Without allowance, simulation or submit will fail.
- Output goes to `recipient` (defaults to the authenticated user’s `accountAddress`).

## API

`POST /api/soroswap/swap` — cookie session **or** `Authorization: Bearer` (OAuth access token).

Body:

```json
{
  "amount_in": "1000000",
  "amount_out_min": "1",
  "path": ["C_TOKEN_IN...", "C_TOKEN_OUT..."],
  "recipient": "G...",
  "deadline_unix": 1893456000,
  "network": "testnet"
}
```

## MCP

Tool: **`soroswap_swap`**. The MCP client should send `Authorization: Bearer` on requests so the server can forward the token to the web API (session continuation without Bearer may not carry the raw token).

## Testnet before mainnet

1. Configure env for **testnet** RPC/Horizon.
2. Fund the hot wallet (XLM + test tokens as needed).
3. Create allowance: approve the **router** contract on the **input** token for the hot wallet.
4. Pick a **path** that has liquidity on Soroswap testnet (two or more `C...` token addresses).
5. Call `soroswap_swap` from MCP or `POST /api/soroswap/swap`, then verify the tx on a Stellar explorer.
6. For **mainnet**, switch `STELLAR_NETWORK`, RPC, Horizon, and router override if Soroswap redeploys; use small amounts first.
