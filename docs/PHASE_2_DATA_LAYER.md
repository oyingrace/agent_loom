# Phase 2 - Data Layer (Stellar-Safe)

Phase 2 establishes a single shared database schema and migration baseline to avoid schema drift across runtimes.

## Implemented

- Added `@agent-loom/database` package as the canonical schema source.
- Added Drizzle ORM and Drizzle Kit tooling.
- Added initial schema covering:
  - users
  - api_proxies
  - request_logs
  - session_keys
  - oauth_clients
  - oauth_auth_codes
  - oauth_access_tokens
  - mcp_servers
  - mcp_server_tools
  - workflow_templates
  - mcp_server_workflows
  - migration_metadata
- Added initial SQL migration at `packages/database/drizzle/0000_initial.sql`.
- Wired `apps/web` and `apps/mcp-server` to consume `@agent-loom/database`.

## Design Notes

- Address fields use flexible string columns and avoid EVM-specific `0x` assumptions.
- JSONB columns are used for workflow and scope configuration to support rapid iteration.
- OAuth and MCP entities mirror `agent_fabric` product capabilities while staying chain-agnostic.

## Next (Phase 3)

- Implement wallet nonce/session APIs in `apps/web`.
- Add OAuth authorize/token/register endpoints.
- Add Redis nonce repository and replay protection.
