import { Keypair, Networks, Account, Address, TransactionBuilder, Operation, nativeToScVal, xdr } from "@stellar/stellar-base";
import { horizonFetchJson } from "./horizonFetch";

type InvokeContract = {
  contractId: string; // C... strkey
  functionName: string;
  args: unknown[]; // natively represented params
};

function getWorkflowHotWalletSecret(): string {
  const secret =
    process.env.WORKFLOW_HOT_WALLET_SECRET ??
    process.env.WORKFLOW_HOT_WALLET_SEED ??
    "";
  if (!secret) {
    throw new Error(
      "WORKFLOW_HOT_WALLET_SECRET is required for live Soroban execution (or WORKFLOW_HOT_WALLET_SEED)."
    );
  }
  return secret;
}

function networkToPassphrase(network: string): string {
  return network === "public" ? Networks.PUBLIC : Networks.TESTNET;
}

/**
 * Best-effort Soroban contract call submission.
 *
 * This currently builds a minimal sorobanData footprint around the contract
 * instance key. More complex contracts may require simulation-driven
 * footprint auth; that enhancement belongs in a later iteration.
 */
export async function submitSorobanContractCall(params: {
  invoke: InvokeContract;
  network: string; // "testnet" | "public"
}): Promise<{ txHash: string }> {
  const { invoke, network } = params;

  const secret = getWorkflowHotWalletSecret();
  const hotKp = Keypair.fromSecret(secret);

  const source = hotKp.publicKey();
  const passphrase = networkToPassphrase(network);

  const acct = await horizonFetchJson<{ sequence: string }>(
    `/accounts/${encodeURIComponent(source)}`
  );

  const sequence = acct.sequence;
  const account = new Account(source, sequence);

  const contractScAddress = Address.fromString(invoke.contractId).toScAddress();
  const argsScVals = invoke.args.map((a) => nativeToScVal(a));

  // Root invocation auth entry for `contractFn`.
  const rootInvocation = new xdr.SorobanAuthorizedInvocation({
    "function": xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: contractScAddress,
        functionName: invoke.functionName,
        args: argsScVals
      })
    ),
    subInvocations: []
  });

  const authEntry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation
  });

  // Minimal soroban footprint: contract instance only.
  const contractInstanceKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contractScAddress,
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent()
    })
  );

  const footprint = new xdr.LedgerFootprint({
    readOnly: [contractInstanceKey],
    readWrite: []
  });

  const defaultFees = {
    instructions: 400000,
    readBytes: 1000,
    writeBytes: 1000,
    resourceFee: 5_000_000n
  };

  const sorobanData = new xdr.SorobanTransactionData({
    resources: new xdr.SorobanResources({
      footprint,
      instructions: defaultFees.instructions,
      diskReadBytes: defaultFees.readBytes,
      writeBytes: defaultFees.writeBytes
    }),
    ext: new xdr.SorobanTransactionDataExt(0),
    resourceFee: new xdr.Int64(defaultFees.resourceFee)
  });

  const txBuilder = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: passphrase
  });
  txBuilder.setSorobanData(sorobanData);

  const operation = Operation.invokeContractFunction({
    contract: invoke.contractId,
    function: invoke.functionName,
    args: argsScVals,
    auth: [authEntry]
  });
  txBuilder.addOperation(operation);
  txBuilder.setTimeout(300);

  const tx = txBuilder.build();
  tx.sign(hotKp);

  const horizonUrl = process.env.STELLAR_HORIZON_URL?.trim() ?? "https://horizon-testnet.stellar.org";
  const res = await fetch(`${horizonUrl.replace(/\/$/, "")}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ tx: tx.toXDR() })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Horizon submission failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { hash?: string };
  if (!json.hash) {
    throw new Error(`Horizon submission succeeded but no hash returned: ${JSON.stringify(json)}`);
  }

  return { txHash: json.hash };
}

