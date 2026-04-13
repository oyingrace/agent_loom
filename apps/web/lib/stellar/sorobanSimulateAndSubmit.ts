import {
  Account,
  Keypair,
  Networks,
  Operation,
  rpc,
  TransactionBuilder
} from "@stellar/stellar-sdk";
import type { xdr } from "@stellar/stellar-sdk";

// Use @stellar/stellar-sdk re-exports for stellar-base so Transaction instances
// match @stellar/stellar-sdk's rpc (pnpm can install multiple @stellar/stellar-base
// versions; v15 tx + v12 assembleTransaction.cloneFrom breaks instanceof).

import { horizonFetchJson } from "./horizonFetch";

function getRpcUrl(): string {
  const u = process.env.STELLAR_RPC_URL?.trim();
  if (!u) {
    throw new Error("STELLAR_RPC_URL is required for Soroban simulate/submit");
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
      "WORKFLOW_HOT_WALLET_SECRET is required for Soroswap execution (or WORKFLOW_HOT_WALLET_SEED)."
    );
  }
  return secret;
}

function networkToPassphrase(network: string): string {
  return network === "public" ? Networks.PUBLIC : Networks.TESTNET;
}

/**
 * Simulate via Soroban RPC, assemble footprint/fees, sign, and submit.
 * Use this for real Soroban contracts (e.g. Soroswap router); do not use the
 * minimal Horizon-only path from `submitSorobanContractCall`.
 */
export async function sorobanSimulateAndSubmit(params: {
  contractId: string;
  functionName: string;
  args: xdr.ScVal[];
  network: "testnet" | "public";
}): Promise<{ txHash: string }> {
  const { contractId, functionName, args, network } = params;

  const secret = getWorkflowHotWalletSecret();
  const kp = Keypair.fromSecret(secret);
  const source = kp.publicKey();
  const passphrase = networkToPassphrase(network);

  const acct = await horizonFetchJson<{ sequence: string }>(
    `/accounts/${encodeURIComponent(source)}`
  );
  const account = new Account(source, acct.sequence);

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: passphrase
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args
      })
    )
    // Required by stellar-base: tx must have time bounds before build().
    .setTimeout(300)
    .build();

  const server = new rpc.Server(getRpcUrl(), { allowHttp: true });
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(kp);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(
      `Soroban sendTransaction failed: ${sent.status} ${String(sent.errorResult ?? "")}`
    );
  }

  return { txHash: sent.hash };
}
