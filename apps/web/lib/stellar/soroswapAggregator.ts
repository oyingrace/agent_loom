import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

export type SoroswapApiNetwork = "testnet" | "mainnet";

function loomNetworkToApi(n: "testnet" | "public"): SoroswapApiNetwork {
  return n === "public" ? "mainnet" : "testnet";
}

export function getSoroswapApiBaseUrl(): string {
  const u = process.env.SOROSWAP_API_BASE_URL?.trim();
  return (u || "https://api.soroswap.finance").replace(/\/$/, "");
}

export function requireSoroswapApiKey(): string {
  const k = process.env.SOROSWAP_API_KEY?.trim();
  if (!k) {
    throw new Error(
      "SOROSWAP_API_KEY is required for Soroswap HTTP aggregator (quote / build / send)."
    );
  }
  return k;
}

function getWorkflowHotWalletSecret(): string {
  const secret =
    process.env.WORKFLOW_HOT_WALLET_SECRET ??
    process.env.WORKFLOW_HOT_WALLET_SEED ??
    "";
  if (!secret) {
    throw new Error(
      "WORKFLOW_HOT_WALLET_SECRET is required for aggregator execution (or WORKFLOW_HOT_WALLET_SEED)."
    );
  }
  return secret;
}

async function soroswapPostJson<T>(params: {
  path: string;
  apiNetwork: SoroswapApiNetwork;
  body: unknown;
}): Promise<T> {
  const key = requireSoroswapApiKey();
  const base = getSoroswapApiBaseUrl();
  const url = `${base}${params.path}?network=${encodeURIComponent(params.apiNetwork)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(params.body)
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = { raw: text.slice(0, 2000) };
  }

  if (!res.ok) {
    throw new Error(
      `Soroswap API ${params.path} failed (${res.status}): ${typeof json === "object" ? JSON.stringify(json) : String(json)}`
    );
  }

  return json as T;
}

export type SoroswapQuoteResponse = Record<string, unknown>;

export async function soroswapAggregatorQuote(params: {
  network: "testnet" | "public";
  assetIn: string;
  assetOut: string;
  amount: string;
  tradeType?: "EXACT_IN" | "EXACT_OUT";
  protocols?: string[];
  slippageBps?: number;
}): Promise<SoroswapQuoteResponse> {
  const apiNetwork = loomNetworkToApi(params.network);
  const body: Record<string, unknown> = {
    assetIn: params.assetIn,
    assetOut: params.assetOut,
    amount: params.amount,
    tradeType: params.tradeType ?? "EXACT_IN",
    protocols: params.protocols ?? ["soroswap", "phoenix", "aqua"]
  };
  if (params.slippageBps !== undefined) {
    body.slippageBps = params.slippageBps;
  }

  return soroswapPostJson<SoroswapQuoteResponse>({
    path: "/quote",
    apiNetwork,
    body
  });
}

export async function soroswapAggregatorBuild(params: {
  network: "testnet" | "public";
  quote: SoroswapQuoteResponse;
  from: string;
  to: string;
}): Promise<{ xdr: string }> {
  const apiNetwork = loomNetworkToApi(params.network);
  const json = await soroswapPostJson<Record<string, unknown>>({
    path: "/quote/build",
    apiNetwork,
    body: {
      quote: params.quote,
      from: params.from,
      to: params.to
    }
  });

  const xdr = typeof json.xdr === "string" ? json.xdr.trim() : "";
  if (!xdr) {
    throw new Error(`Soroswap build response missing xdr: ${JSON.stringify(json)}`);
  }
  return { xdr };
}

export async function soroswapAggregatorSend(params: {
  network: "testnet" | "public";
  signedTxXdr: string;
}): Promise<{ txHash: string; raw: Record<string, unknown> }> {
  const apiNetwork = loomNetworkToApi(params.network);
  const json = await soroswapPostJson<Record<string, unknown>>({
    path: "/send",
    apiNetwork,
    body: { xdr: params.signedTxXdr }
  });

  const txHash =
    (typeof json.txHash === "string" && json.txHash) ||
    (typeof json.hash === "string" && json.hash) ||
    (typeof json.transactionHash === "string" && json.transactionHash) ||
    "";

  if (!txHash) {
    throw new Error(`Soroswap send response missing tx hash: ${JSON.stringify(json)}`);
  }

  return { txHash, raw: json };
}

export function signTransactionXdrWithSecret(params: {
  unsignedXdr: string;
  network: "testnet" | "public";
}): string {
  const passphrase =
    params.network === "public" ? Networks.PUBLIC : Networks.TESTNET;
  const kp = Keypair.fromSecret(getWorkflowHotWalletSecret());
  const tx = TransactionBuilder.fromXDR(params.unsignedXdr, passphrase);
  tx.sign(kp);
  return tx.toXDR();
}

/**
 * Quote → build (hot wallet signs) → Soroswap /send relay.
 * `from` must be the hot wallet G address; `to` is usually the output recipient (user).
 */
export async function executeSoroswapAggregatorSwap(params: {
  network: "testnet" | "public";
  assetIn: string;
  assetOut: string;
  amount: string;
  from: string;
  to: string;
  tradeType?: "EXACT_IN" | "EXACT_OUT";
  protocols?: string[];
  slippageBps?: number;
}): Promise<{
  txHash: string;
  quote: SoroswapQuoteResponse;
  send: Record<string, unknown>;
}> {
  const quote = await soroswapAggregatorQuote({
    network: params.network,
    assetIn: params.assetIn,
    assetOut: params.assetOut,
    amount: params.amount,
    tradeType: params.tradeType,
    protocols: params.protocols,
    slippageBps: params.slippageBps
  });

  const { xdr } = await soroswapAggregatorBuild({
    network: params.network,
    quote,
    from: params.from,
    to: params.to
  });

  const signed = signTransactionXdrWithSecret({
    unsignedXdr: xdr,
    network: params.network
  });

  const { txHash, raw } = await soroswapAggregatorSend({
    network: params.network,
    signedTxXdr: signed
  });

  return { txHash, quote, send: raw };
}
