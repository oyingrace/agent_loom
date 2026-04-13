# Phase 4 — Stellar Ed25519 Session Signatures

## What changed

Phase 3 allowed creating a session with only a nonce. **Phase 4 requires a wallet signature** over a canonical message so only the holder of the account secret can obtain a cookie session.

## Supported accounts

- **Ed25519 public key strkeys (`G…`)** only for this login path.
- **Contract strkeys (`C…`)** are not supported yet (no standard “sign in as contract” message in this flow).

## Flow

1. `GET /api/auth/nonce` returns:
   - `nonce` — single-use Redis token
   - `messageVersion` — `agent_loom auth v1`
   - `domain` — from `NEXT_PUBLIC_AUTH_DOMAIN`, or hostname of `NEXT_PUBLIC_APP_URL` (must match server when verifying)

2. Build the exact UTF-8 string (order and newlines matter):

```
agent_loom auth v1
nonce: <nonce>
account: <G address>
domain: <domain from step 1>
```

3. Sign the UTF-8 bytes with the account’s Ed25519 key (same as Stellar transaction signing key material).

4. `POST /api/auth/session` with JSON:

```json
{
  "accountAddress": "G…",
  "nonce": "<same nonce>",
  "signature": "<base64 64-byte signature, or 128 hex chars>"
}
```

The server verifies the signature **before** consuming the nonce.

## Environment

- `NEXT_PUBLIC_APP_URL` — used to derive `domain` when `NEXT_PUBLIC_AUTH_DOMAIN` is unset.
- `NEXT_PUBLIC_AUTH_DOMAIN` — optional explicit hostname for the signed `domain:` line (recommended in production behind proxies).

## Implementation

- `@stellar/stellar-base` — `StrKey`, `Keypair` verification
- `lib/stellar/authMessage.ts` — canonical message
- `lib/stellar/authDomain.ts` — domain resolution
- `lib/stellar/verifySignature.ts` — Ed25519 verify
- `lib/stellar/address.ts` — strkey decode validation for `G` / `C` (non-auth use)
