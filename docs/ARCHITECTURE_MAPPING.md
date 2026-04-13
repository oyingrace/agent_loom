# Architecture Mapping: `agent_fabric` -> `agent_loom`

This file maps existing `agent_fabric` subsystems to Stellar-native replacements.

## A) System Topology

- **Keep:** Monorepo layout and separation of concerns.
- **Replace:** EVM-only internals and chain-specific validation logic.

## B) Component Mapping

1. **Web app APIs**
   - Fabric: Next.js API routes for auth, OAuth, sessions, proxy execution, workflows, relayer.
   - Loom: Same API surface pattern with Stellar-compatible auth/signature/payment logic.
   - Status: **Reuse architecture, rewrite blockchain/payment internals**.

2. **MCP server runtime**
   - Fabric: dynamic tool registry, OAuth bearer checks, MCP slug transport.
   - Loom: same runtime pattern and discovery endpoints.
   - Status: **High reuse**.

3. **Workflow engine**
   - Fabric: `http`, `condition`, `transform`, `onchain` (EVM encoding).
   - Loom: same orchestration and expression model, new Soroban `onchain` step payload.
   - Status: **Reuse core engine, rewrite onchain adapter**.

4. **Session delegation**
   - Fabric: EVM session keys + EIP/EVM signature semantics.
   - Loom: Stellar-native scoped delegated execution model.
   - Status: **Concept reuse, protocol rewrite**.

5. **Paid proxy economy**
   - Fabric: x402 + EIP-3009 verification/settlement.
   - Loom: Stellar **x402 facilitator** verify/settle + optional **legacy** Horizon memo proof; settle-on-upstream-2xx.
   - Status: **Economic model reuse, protocol rewrite**.

6. **Contract layer**
   - Fabric: Solidity `AgentDelegator`.
   - Loom: Soroban contract(s) enforcing scope, expiry, nonce, allowed targets.
   - Status: **Rewrite**.

7. **Data model**
   - Fabric: PostgreSQL + Drizzle, with EVM-leaning fields.
   - Loom: PostgreSQL + Drizzle with Stellar-safe identifiers and chain-agnostic typed columns.
   - Status: **Partial reuse with migration redesign**.

## C) Endpoint-Level Strategy

- Keep endpoint categories and lifecycle:
  - auth nonce/session
  - OAuth/OIDC metadata + token endpoints
  - proxies CRUD + execution
  - workflows CRUD + test execution
  - sessions CRUD + scoped sign/execute
  - MCP management/discovery routes
- Replace payload schemas where they include EVM-specific assumptions.

## D) Priority Rewrite Areas

1. Signature verification and session grant format.
2. On-chain step DSL and executor.
3. Payment proof verification and settlement.
4. Address and network validation rules across APIs and DB.

## E) Known Risks and Mitigations

1. **Risk:** Hidden EVM assumptions in validators and DB constraints.  
   **Mitigation:** Introduce chain-agnostic types and strict Stellar validators in Phase 1 schema work.

2. **Risk:** Workflow migration incompatibility for existing `onchain` definitions.  
   **Mitigation:** Version workflow schema from the start.

3. **Risk:** Payment and delegation coupling causes late-stage rewrites.  
   **Mitigation:** Define canonical auth/payment message contracts before feature coding.

