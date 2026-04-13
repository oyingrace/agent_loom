# Phase 3 — Auth, Redis Nonces, OAuth

## Implemented

### Wallet session (Stellar-shaped)

- `GET /api/auth/nonce` — issues a single-use Redis nonce.
- `POST /api/auth/session` — consumes nonce, creates or loads `users` by Stellar strkey (`G…` / `C…`), sets iron-session cookie.
- `GET /api/auth/session` — current session.
- `DELETE /api/auth/session` — logout.

**Update:** **Phase 4** adds Ed25519 signature verification for `POST /api/auth/session`. See `docs/PHASE_4_STELLAR_AUTH.md`.

### Redis

- `lib/redis/client.ts` — singleton `ioredis` client (`REDIS_URL`).
- `lib/repositories/nonce.ts` — atomic consume pattern (same idea as `agent_fabric`).

### OAuth 2.x (PKCE)

- `POST /api/oauth/register` — dynamic client registration; **requires signed-in web session** (schema requires `owner_user_id`).
- `GET /oauth/authorize` — browser consent page (Agent Fabric–style scope cards); loads metadata from `GET /api/oauth/authorize` with the same query params.
- `GET /api/oauth/authorize` — validates query params; returns JSON metadata for programmatic clients or the consent page.
- `POST /api/oauth/authorize` — authenticated user; creates authorization code (optional `session_key_id` if present in DB).
- `POST /api/oauth/token` — exchanges code + PKCE for bearer access token.

### Schema additions

- `oauth_clients.allowed_scopes` (JSONB).
- `oauth_auth_codes.redirect_uri` (TEXT).

Migrations: `packages/database/drizzle/0000_initial.sql` (greenfield) and `0001_oauth_allowed_scopes_and_redirect.sql` (existing DBs).

### Environment

- `DATABASE_URL` — required for session and OAuth persistence.
- `REDIS_URL` — required for nonces in production-like setups.
- `APP_SESSION_SECRET` or `SESSION_SECRET` — **≥ 32 characters** for iron-session.
