# Phase 5 — Paid API Proxies (Stellar)

## Overview

Phase 5 adds **owner CRUD** for `api_proxies` and a **public paid proxy** runtime aligned with `agent_fabric`’s economics: **402 without payment**, **verify before upstream**, **settle only on upstream 2xx** — implemented on **Stellar** (not EVM).

Two client payment paths are supported:

1. **Stellar x402** (recommended for new integrations): facilitator **verify** + **settle** using a base64 **`PaymentPayload`** on `X-PAYMENT`. See [x402 on Stellar](https://developers.stellar.org/docs/build/agentic-payments/x402).
2. **Legacy Horizon memo**: TEXT memo binding + JSON `X-PAYMENT` with `txHash` + `paymentNonce`, verified via Horizon.

## Owner APIs (session required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/proxies` | List current user’s proxies |
| `POST` | `/api/proxies` | Create proxy |
| `GET` | `/api/proxies/[id]` | Get by UUID or slug (owner) |
| `PATCH` | `/api/proxies/[id]` | Update (owner) |
| `DELETE` | `/api/proxies/[id]` | Delete (owner) |

`encryptedHeaders` is stored as a **JSON string** in the DB (e.g. `{"Authorization":"Bearer …"}`); hybrid encryption can replace this later.

## Public proxy

| Method | Path | Auth |
|--------|------|------|
| `*` | `/api/proxy/[id]` | None (proxy must be `is_active`) |

`[id]` may be the proxy **UUID** or **slug**.

### x402 flow

1. Call the proxy **without** `X-PAYMENT` → **402** with `accepts: [PaymentRequirements]` (and optional `legacyMemoPayment` when enabled).
2. Build and sign a Stellar payment matching `accepts[0]`; wrap as **`PaymentPayload`**, then base64-encode for **`X-PAYMENT`** (see `x402-stellar` `encodePaymentHeader`).
3. Retry with header `X-PAYMENT: <base64>`. The server calls the configured facilitator to verify and settle.

Environment (optional overrides):

- `X402_FACILITATOR_URL` — defaults to `https://facilitator.stellar-x402.org`
- `X402_FACILITATOR_API_KEY` — if the facilitator requires a bearer token
- `X402_INCLUDE_LEGACY_MEMO_402` — set to `false` to omit `legacyMemoPayment` from 402 bodies (x402-only clients)

### Legacy memo flow

1. Call the proxy **without** `X-PAYMENT` → **402** with `legacyMemoPayment` (when enabled) including `paymentNonce` and Horizon fields.
2. Submit a **successful** Stellar payment with **memo (text)** = `paymentNonce` and amount/asset/destination as specified.
3. Retry with:

```http
X-PAYMENT: {"txHash":"<horizon transaction hash>","paymentNonce":"<same nonce>"}
```

4. The server verifies via **Horizon** (`STELLAR_HORIZON_URL`), then forwards. **Settlement**: the on-chain tx is the payment; we **mark the tx hash used** and **consume the nonce** when the **upstream response is 2xx**.

If upstream is not 2xx, the **same** transaction hash can be retried (nonce stays valid until a successful charge).

### Replay protection

- Redis: payment memo nonces (`ProxyPaymentNonceRepository`).
- Redis: `tx` hash used-set + short lock during upstream fetch.

### Assets

- `pricingAsset`: `native` / `XLM`, `CODE:ISSUER`, or contract-style identifiers per `PaymentRequirements` / proxy validation.
- x402 `maxAmountRequired` is expressed as **stroops** (integer string) in `accepts[0]` for facilitator compatibility.

## Environment

- `STELLAR_HORIZON_URL` — e.g. `https://horizon-testnet.stellar.org`
- `REDIS_URL` — required for nonces and tx replay keys
- `DATABASE_URL` — proxies and `request_logs`

## Logging

Each attempt writes a row to `request_logs` with status and a small JSON summary.
