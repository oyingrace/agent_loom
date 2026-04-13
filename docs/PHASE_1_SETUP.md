# Phase 1 Setup

## Workspace

- `apps/web`: Next.js app shell.
- `apps/mcp-server`: MCP runtime shell (Express for now).
- `packages/contracts`: shared contract adapters/artifacts package placeholder.
- `packages/payment`: shared payment validation/types package placeholder.

## Commands

From repo root:

- `pnpm install`
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Notes

- Phase 1 scaffolded the repo layout; later phases added DB, auth, proxies, MCP, and workflows — see root `README.md` and `docs/PHASE_*.md` for current behavior.
