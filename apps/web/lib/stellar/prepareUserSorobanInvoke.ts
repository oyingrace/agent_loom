import {
  Account,
  Networks,
  Operation,
  rpc,
  TransactionBuilder
} from "@stellar/stellar-sdk";
import { nativeToScVal } from "@stellar/stellar-base";
import { horizonFetchJson } from "./horizonFetch";

function getRpcUrl(): string {
  const u = process.env.STELLAR_RPC_URL?.trim();
  if (!u) {
    throw new Error(
      "STELLAR_RPC_URL is required for user-signed Soroban (simulate + unsigned XDR)"
    );
  }
  return u.replace(/\/$/, "");
}

function networkToPassphrase(network: "testnet" | "public"): string {
  return network === "public" ? Networks.PUBLIC : Networks.TESTNET;
}

/**
 * Build a Soroban invoke tx from the user's account, simulate via RPC, return
 * unsigned XDR for Freighter / WalletsKit (Fabric-like: user custody).
 */
export async function prepareUnsignedSorobanInvoke(params: {
  sourceAccount: string;
  contractId: string;
  functionName: string;
  args: unknown[];
  network: "testnet" | "public";
}): Promise<{ unsignedXdr: string }> {
  const { sourceAccount, contractId, functionName, args, network } = params;
  const passphrase = networkToPassphrase(network);

  const acct = await horizonFetchJson<{ sequence: string }>(
    `/accounts/${encodeURIComponent(sourceAccount)}`
  );
  const account = new Account(sourceAccount, acct.sequence);

  const argsScVals = args.map((a) => nativeToScVal(a));

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: passphrase
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        // stellar-sdk bundles a different stellar-base than the app; values are compatible at runtime.
        args: argsScVals as unknown as Parameters<
          typeof Operation.invokeContractFunction
        >[0]["args"]
      })
    )
    .setTimeout(300)
    .build();

  const server = new rpc.Server(getRpcUrl(), { allowHttp: true });
  const prepared = await server.prepareTransaction(tx);
  return { unsignedXdr: prepared.toXDR() };
}
