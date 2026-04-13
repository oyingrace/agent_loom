Stellar developer docs index: [developers.stellar.org/llms.txt](https://developers.stellar.org/llms.txt).

# Stellar Stack Decisions (Phase 0)

This is a decision record for the first implementation cycle.

## Decision 1: Chain Runtime

- **Decision:** Build on Stellar with Soroban smart contracts.
- **Rationale:** Native contract model for Stellar and direct alignment with target ecosystem.

## Decision 2: On-Chain Data Access

- **Decision:** Use Stellar RPC first; Horizon only where ecosystem tools still require it.
- **Rationale:** RPC is the contract-era primary interface and better aligned with Soroban flows.

## Decision 3: Contract Invocation Model

- **Decision:** Replace EVM `target + selector + calldata + value` step format with Soroban invocation schema.
- **Rationale:** EVM call encoding does not map directly to Soroban.

## Decision 4: Identity And Address Format

- **Decision:** Store Stellar account/contract identifiers as chain-agnostic strings with strict Stellar validation at service boundaries.
- **Rationale:** Removes EVM-specific `0x` and fixed-length assumptions.

## Decision 5: Delegated Session Authorization

- **Decision:** Keep delegated sessions as a product concept, implemented via Stellar-compatible signature/auth verification primitives.
- **Rationale:** Session-based agent execution is core to UX and automation.

## Decision 6: Payment Layer

- **Decision:** Keep "verify then settle on success" economic flow, implemented with Stellar-asset-native proofs and settlement.
- **Rationale:** Preserves marketplace/tool economics while changing protocol internals.

## Decision 7: App Architecture

- **Decision:** Preserve high-level topology:
  - `apps/web` (UI + APIs)
  - `apps/mcp-server` (MCP runtime)
  - `packages/contracts` (Soroban contract artifacts/adapters)
  - `packages/payment` (Stellar payment/auth helpers)
- **Rationale:** Existing architecture proved workable and supports parallel delivery.

## Decision 8: Delivery Network

- **Decision:** Testnet-first delivery and hardening before Mainnet.
- **Rationale:** Reduces protocol and operational risk during early integration.

## Open Questions (historical; many resolved in code)

1. Wallet UX: Stellar Wallets Kit is integrated in the web app (`@creit.tech/stellar-wallets-kit`).
2. Payment proof: **legacy** JSON on `X-PAYMENT` and **Stellar x402** base64 `PaymentPayload` (see `docs/PHASE_5_PAID_PROXY.md`, MCP `x402_header` in `docs/PHASE_6_MCP.md`).
3. Session grant signing payload format and replay domain strategy — still product-dependent.
4. Soroban contract boundary: single contract vs modular contracts — still open for product scope.

