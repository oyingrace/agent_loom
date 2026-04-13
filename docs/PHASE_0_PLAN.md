# Phase 0 - Foundation And Scope Lock

This document is the implementation baseline for Phase 0.

## 1) Goal

Create a locked foundation for building a Stellar version of `agent_fabric` inside `agent_loom` before writing production code.

## 2) MVP Scope Lock (Must Have)

The initial deliverable is feature parity at the product level, not protocol-level parity with EVM internals.

Required MVP capabilities:

1. Wallet-authenticated user access.
2. OAuth 2.1 flow for MCP clients (`authorize`, `token`, client registration).
3. MCP server runtime with slug-scoped tools.
4. Tool types:
   - paid HTTP proxy tool
   - workflow tool
5. Workflow engine with:
   - `http`
   - `condition`
   - `transform`
   - `onchain` (Stellar/Soroban operation model)
6. Session delegation model with scope + expiry + replay protection.
7. Payment verification and settlement flow for Stellar assets.

Not in MVP:

- multi-chain support
- advanced background worker orchestration
- full marketplace ranking/analytics sophistication
- migration tooling from live EVM production data

## 3) Non-Goals

- Reproducing ERC-7702, ERC-4337, ERC-1271, EIP-712, and EIP-3009 behavior exactly.
- Preserving EVM calldata/selector transaction model.
- Shipping Mainnet-first before Testnet hardening.

## 4) Foundation Decisions

See `docs/STELLAR_STACK_DECISIONS.md` for concrete decisions that unblock implementation.

## 5) Architecture Mapping

See `docs/ARCHITECTURE_MAPPING.md` for a side-by-side map from `agent_fabric` components to `agent_loom`.

## 6) Phase 0 Exit Criteria

Phase 0 is complete when all are true:

1. MVP scope is explicit and versioned in-repo.
2. Core Stellar stack decisions are documented and actionable.
3. Architecture mapping exists with "reuse vs rewrite" status.
4. Key risks are listed with mitigation approach.
5. Next implementation phase tasks are defined.

## 7) Phase 1 Ready Tasks

Immediate next tasks:

1. Scaffold monorepo structure (`apps/web`, `apps/mcp-server`, `packages/contracts`, `packages/payment`).
2. Establish base toolchain (pnpm workspace, TypeScript, linting, testing).
3. Create initial environment templates.
4. Draft first DB schema migration for Stellar-safe identifiers.

