# Agent Loom — Soroban contracts

This folder holds **on-chain** pieces for Fabric-like flows on Stellar: **owner signs once**, **relayer executes repeatedly** under **contract-enforced rules**.

## Prerequisites

- [Rust / rustup](https://rustup.rs/) — the repo pins a toolchain in [`rust-toolchain.toml`](./rust-toolchain.toml) (1.85+). If you do not have it yet:

  ```bash
  rustup toolchain install 1.85
  ```

- **Stellar CLI** (optional, for deploy): [Install Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools) — provides `stellar contract build` / `stellar contract deploy`.

## Layout

| Crate | Purpose |
|--------|---------|
| [`loom-session`](./loom-session) | MVP **policy contract**: `init` (owner) stores `relayer` + daily spend cap; `relay_execute` (relayer) checks auth, nonce, and daily limit. **Next:** add `invoke_swap` / router integration. |

## Commands

From `contracts/`:

```bash
cargo test -p loom-session
stellar contract build --package loom-session --optimize
```

**Wasm output path** depends on the toolchain / CLI:

- **Stellar CLI (current):** `target/wasm32v1-none/release/loom_session.wasm`
- **Older docs / raw Cargo:** sometimes `target/wasm32-unknown-unknown/release/loom_session.wasm`

If `ls target/wasm32-unknown-unknown/...` is empty, use `find target -name 'loom_session.wasm'` — your build log already shows the real path.

**Deploy** (use the path from your build summary):

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/loom_session.wasm \
  --source-account <identity> \
  --network testnet \
  --alias loom-session
```

## Roadmap (short)

1. **Done (scaffold):** `loom-session` auth + daily cap + nonce (abstract `spend_amount` units).
2. **Next:** deploy to testnet, store contract ID in env, call `relay_execute` from a small **TypeScript relayer** in `apps/web` (same pattern as existing Soroban helpers).
3. **Then:** token + Soroswap router — either **contract holds user deposits** or **SEP-41 allowance** to a vault; design depends on product risk tolerance.
4. **Production:** external audit, formal limits, optional **sponsored** fees.

## Notes

- This is **not** a drop-in of Agent Fabric’s EVM stack; it is the Stellar-native equivalent **pattern** (policy contract + relayer key).
- Until router integration exists, **relayer calls only touch this contract** — no swaps yet.
