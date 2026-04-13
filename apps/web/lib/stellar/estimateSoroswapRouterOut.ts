import {
  Account,
  Keypair,
  Networks,
  Operation,
  rpc,
  TransactionBuilder
} from "@stellar/stellar-sdk";
import { scValToNative } from "@stellar/stellar-base";
import { Api } from "@stellar/stellar-sdk/rpc";
import { horizonFetchJson } from "./horizonFetch";
import { buildSwapExactTokensForTokensArgs } from "./buildSoroswapSwapArgs";
import { getSoroswapRouterContractId } from "./soroswapAddresses";

function getRpcUrl(): string {
  const u = process.env.STELLAR_RPC_URL?.trim();
  if (!u) {
    throw new Error("STELLAR_RPC_URL is required for Soroswap simulation");
  }
  return u.replace(/\/$/, "");
}

function getWorkflowHotWalletSecret(): string {
  const secret =
    process.env.WORKFLOW_HOT_WALLET_SECRET ??
    process.env.WORKFLOW_HOT_WALLET_SEED ??
    "";
  if (!secret) {
    throw new Error(
      "WORKFLOW_HOT_WALLET_SECRET is required for swap simulation (or WORKFLOW_HOT_WALLET_SEED)."
    );
  }
  return secret;
}

function networkToPassphrase(network: "testnet" | "public"): string {
  return network === "public" ? Networks.PUBLIC : Networks.TESTNET;
}

/**
 * Simulate `swap_exact_tokens_for_tokens` with amount_out_min = 0 to read the
 * returned Vec<i128> (per-hop amounts); the last value is the final output.
 */
export async function estimateSoroswapRouterAmountOut(params: {
  amountIn: bigint;
  path: string[];
  recipient: string;
  deadline: bigint;
  network: "testnet" | "public";
}): Promise<{ amounts: bigint[]; amountOut: bigint }> {
  const { amountIn, path, recipient, deadline, network } = params;
  if (path.length < 2) {
    throw new Error("path must have at least two token contracts");
  }

  const secret = getWorkflowHotWalletSecret();
  const kp = Keypair.fromSecret(secret);
  const source = kp.publicKey();
  const passphrase = networkToPassphrase(network);
  const router = getSoroswapRouterContractId(network);

  const acct = await horizonFetchJson<{ sequence: string }>(
    `/accounts/${encodeURIComponent(source)}`
  );
  const account = new Account(source, acct.sequence);

  const args = buildSwapExactTokensForTokensArgs({
    amountIn,
    amountOutMin: 0n,
    path,
    to: recipient,
    deadline
  });

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: passphrase
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: router,
        function: "swap_exact_tokens_for_tokens",
        args
      })
    )
    .setTimeout(300)
    .build();

  const server = new rpc.Server(getRpcUrl(), { allowHttp: true });
  const sim = await server.simulateTransaction(tx);

  if (Api.isSimulationError(sim)) {
    throw new Error(`Soroswap simulation failed: ${sim.error}`);
  }

  if (!Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    throw new Error("Simulation did not return a contract result");
  }

  const retval = sim.result.retval;

  // stellar-sdk bundles a different stellar-base than the app; runtime values are compatible.
  const native = scValToNative(retval as never) as unknown;
  if (!Array.isArray(native) || native.length === 0) {
    throw new Error("Unexpected swap return shape (expected non-empty Vec)");
  }

  const amounts = native.map((v) => {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(Math.trunc(v));
    throw new Error("Unexpected amount type in swap simulation result");
  });

  const amountOut = amounts[amounts.length - 1];
  if (amountOut === undefined) {
    throw new Error("Unexpected empty swap amounts");
  }

  return { amounts, amountOut };
}

export function applySlippageMin(amountOut: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("slippageBps must be between 0 and 10000");
  }
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}
