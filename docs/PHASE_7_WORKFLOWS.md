# Phase 7 — Workflow templates (dry-run + live)

This phase adds **workflow template** CRUD on the web API, a shared **`@agent-loom/workflow`** package (Stellar-oriented step types, validation, expression resolution), **dry-run** and **live** execution, optional **public** listing, and **MCP workflow tools** that invoke **`runDryWorkflow`** only (MCP does not run live HTTP/Soroban today).

## Workflow definition (v1.0)

Steps are sequential. Supported `type` values:

| Type | Purpose |
|------|---------|
| `http` | Paid proxy (`proxyId`) or external `url`. Dry-run simulates; live calls the real endpoint. |
| `condition` | Boolean from `condition.expression`. |
| `transform` | `transform.expression` resolved via the context. |
| `soroban` | `contractId`, `function`, optional `argsMapping`. Dry-run simulates; live submits via server hot wallet (see below). |
| `soroban_batch` | Multiple Soroban operations. |

Optional `inputVariables` on the root JSON drives MCP workflow tool input schemas (Zod).

Expressions use the same `$.` prefix as Fabric: `$.wallet`, `$.network`, `$.timestamp`, `$.input.*`, `$.steps.<outputAs>.output.*`.

## Web API

| Method | Path | Auth |
|--------|------|------|
| `GET` / `POST` | `/api/workflows` | Session |
| `GET` / `PUT` / `DELETE` | `/api/workflows/[id]` | Session |
| `POST` | `/api/workflows/[id]/test` | Session; see below |
| `GET` | `/api/workflows/public` | None; optional `search`, `page`, `limit` |

### `POST /api/workflows/[id]/test`

| Body | Behavior |
|------|----------|
| `{ "inputs": {}, "dryRun": true }` (default) | **`runDryWorkflow`** — simulated HTTP/Soroban outputs. |
| `{ "inputs": {}, "dryRun": false }` | **`runLiveWorkflow`** — real HTTP steps; paid proxy steps may return **402** `approval_required` until payment evidence is supplied. |
| `dryRun: false` + `x_payment` | Payment evidence for paid `http` steps. Supports **legacy** `{ txHash, paymentNonce }` or **x402** `{ x402Header }` (base64 `PaymentPayload`). |

Live **Soroban** steps require `WORKFLOW_HOT_WALLET_SECRET` or `WORKFLOW_HOT_WALLET_SEED` on the web server (see `apps/web/lib/stellar/submitSorobanContractCall.ts`).

### UI

The workflow **test** panel (`WorkflowTestPanel`) supports dry vs live runs and wallet signing for paid proxy steps (legacy memo path or **x402** per `accepts[0]` when legacy memo 402 is disabled).

## MCP

Workflow tools are loaded from `mcp_server_workflows` joined to `workflow_templates`. Tool names are the configured `tool_name` values. Each invocation runs **`runDryWorkflow`** with the OAuth user’s Stellar account as `$.wallet`.

**Live** workflow execution remains a **web-session** path (`/api/workflows/[id]/test`); MCP workflow tools are intentionally **dry-run** for predictable agent behavior.

## Related docs

- Paid proxy + payment headers: `docs/PHASE_5_PAID_PROXY.md`
- MCP proxy tools (`x402_header`, legacy `x_payment`): `docs/PHASE_6_MCP.md`
