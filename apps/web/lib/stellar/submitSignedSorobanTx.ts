import { Networks, rpc, TransactionBuilder } from "@stellar/stellar-sdk";

function getRpcUrl(): string {
  const u = process.env.STELLAR_RPC_URL?.trim();
  if (!u) {
    throw new Error("STELLAR_RPC_URL is required to submit signed Soroban txs");
  }
  return u.replace(/\/$/, "");
}

function networkToPassphrase(network: "testnet" | "public"): string {
  return network === "public" ? Networks.PUBLIC : Networks.TESTNET;
}

/**
 * Submit a user-signed Soroban transaction (relayer submit; user still holds keys).
 */
export async function submitSignedSorobanTx(params: {
  signedTxXdr: string;
  network: "testnet" | "public";
}): Promise<{ txHash: string }> {
  const passphrase = networkToPassphrase(params.network);
  const tx = TransactionBuilder.fromXDR(params.signedTxXdr, passphrase);
  const server = new rpc.Server(getRpcUrl(), { allowHttp: true });
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(
      `Soroban sendTransaction failed: ${sent.status} ${String(sent.errorResult ?? "")}`
    );
  }
  return { txHash: sent.hash };
}
