/**
 * Terminal smoke: call Soroswap testnet router `swap_exact_tokens_for_tokens`
 * using the same code path as POST /api/soroswap/swap (no Claude / no OAuth).
 *
 * Run from repo root:
 *   pnpm exec tsx apps/web/scripts/soroswap-testnet-swap.ts -- --path C_TOKEN_A,C_TOKEN_B
 *
 * Requires (in .env or env):
 * - WORKFLOW_HOT_WALLET_SECRET — Stellar S... secret (hot wallet)
 * - STELLAR_RPC_URL — e.g. https://soroban-testnet.stellar.org
 * - STELLAR_HORIZON_URL — e.g. https://horizon-testnet.stellar.org
 * - STELLAR_NETWORK=testnet (or pass --network testnet)
 *
 * The hot wallet must hold `amount_in` of the *first* path token and have approved
 * the Soroswap router on that token (SEP-41 allowance). Native XLM alone is not
 * a `C...` path leg — use SAC/wrapped assets that have a Soroswap pool.
 *
 * Testnet router default: https://github.com/soroswap/core/blob/main/public/testnet.contracts.json
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Keypair } from "@stellar/stellar-sdk";

import { buildSwapExactTokensForTokensArgs } from "../lib/stellar/buildSoroswapSwapArgs";
import { sorobanSimulateAndSubmit } from "../lib/stellar/sorobanSimulateAndSubmit";
import { getSoroswapRouterContractId } from "../lib/stellar/soroswapAddresses";

function loadEnvFromRoot() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "apps/web/.env.local")
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

async function main() {
  loadEnvFromRoot();

  const pathRaw = arg("--path");
  if (!pathRaw) {
    console.error(
      `Usage: pnpm exec tsx apps/web/scripts/soroswap-testnet-swap.ts -- --path C_TOKEN_IN,C_TOKEN_OUT [options]

Options:
  --amount-in <string>     smallest units of first path token (default: 1000000)
  --amount-out-min <string>  min out (default: 1)
  --recipient <G...>       output recipient (default: hot wallet public key)
  --network testnet|public (default: testnet)
`
    );
    process.exit(1);
  }

  const path = pathRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const amountIn = arg("--amount-in") ?? "1000000";
  const amountOutMin = arg("--amount-out-min") ?? "1";
  const network = (arg("--network") as "testnet" | "public" | undefined) ?? "testnet";

  if (network !== "testnet" && network !== "public") {
    console.error("network must be testnet or public");
    process.exit(1);
  }

  const secret =
    process.env.WORKFLOW_HOT_WALLET_SECRET ??
    process.env.WORKFLOW_HOT_WALLET_SEED ??
    "";
  if (!secret) {
    console.error("Set WORKFLOW_HOT_WALLET_SECRET (Stellar S... secret)");
    process.exit(1);
  }

  const kp = Keypair.fromSecret(secret);
  const recipient = arg("--recipient")?.trim() ?? kp.publicKey();

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const router = getSoroswapRouterContractId(network);

  const args = buildSwapExactTokensForTokensArgs({
    amountIn: BigInt(amountIn),
    amountOutMin: BigInt(amountOutMin),
    path,
    to: recipient,
    deadline
  });

  console.log("Router:", router);
  console.log("Hot wallet:", kp.publicKey());
  console.log("Recipient:", recipient);
  console.log("Path:", path.join(" -> "));

  const { txHash } = await sorobanSimulateAndSubmit({
    contractId: router,
    functionName: "swap_exact_tokens_for_tokens",
    args,
    network
  });

  console.log("Submitted:", txHash);
  console.log(
    `Explorer: https://stellar.expert/explorer/${network === "public" ? "public" : "testnet"}/tx/${txHash}`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
