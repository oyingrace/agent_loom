export type TrendingToken = {
  rank: number;
  contract: string;
  symbol?: string;
};

export type TrendingResult = {
  source: "external_api" | "curated_testnet";
  disclaimer: string;
  tokens: TrendingToken[];
};

const CURATED_TESTNET: TrendingToken[] = [
  {
    rank: 1,
    symbol: "USDC",
    contract: "CBBHRKEP5M3NUDRISGLJKGHDHX3DA2CN2AZBQY6WLVUJ7VNLGSKBDUCM"
  }
];

function expandTrendingUrlTemplate(url: string, network: string, limit: number): string {
  return url
    .replaceAll("{network}", encodeURIComponent(network))
    .replaceAll("{limit}", String(limit));
}

function normalizeExternalPayload(json: unknown, limit: number): TrendingToken[] {
  const raw =
    json &&
    typeof json === "object" &&
    "tokens" in json &&
    Array.isArray((json as { tokens: unknown }).tokens)
      ? (json as { tokens: unknown[] }).tokens
      : Array.isArray(json)
        ? json
        : null;

  if (!raw) {
    throw new Error('Expected JSON { "tokens": [...] } or a top-level array');
  }

  const out: TrendingToken[] = [];
  let rank = 1;
  for (const item of raw) {
    if (out.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const contract = (item as { contract?: string }).contract?.trim();
    if (!contract || !contract.startsWith("C")) continue;
    const symbol =
      typeof (item as { symbol?: string }).symbol === "string"
        ? (item as { symbol: string }).symbol
        : undefined;
    const r =
      typeof (item as { rank?: number }).rank === "number"
        ? (item as { rank: number }).rank
        : rank;
    out.push({ rank: r, contract, symbol });
    rank += 1;
  }
  return out;
}

/**
 * Ranked Soroban `C...` tokens for agent workflows.
 *
 * 1. If `STELLAR_TRENDING_API_URL` is set, GET that URL (supports `{network}` and `{limit}` in the string).
 * 2. Else on testnet, return a tiny curated list (demo only).
 * 3. On mainnet without URL, throws — there is no global Stellar "trending" endpoint.
 */
export async function fetchTrendingStellarTokens(params: {
  network: "testnet" | "public";
  limit: number;
}): Promise<TrendingResult> {
  const { network, limit } = params;
  const template = process.env.STELLAR_TRENDING_API_URL?.trim();

  if (template) {
    const url = expandTrendingUrlTemplate(template, network, limit);
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      throw new Error(`STELLAR_TRENDING_API_URL fetch failed: ${res.status} ${res.statusText}`);
    }
    const json: unknown = await res.json();
    const tokens = normalizeExternalPayload(json, limit);
    if (tokens.length === 0) {
      throw new Error("Trending API returned no valid token contracts");
    }
    return {
      source: "external_api",
      disclaimer:
        "Rankings come from STELLAR_TRENDING_API_URL. Verify liquidity and token identity before swapping.",
      tokens
    };
  }

  if (network === "testnet") {
    return {
      source: "curated_testnet",
      disclaimer:
        "No STELLAR_TRENDING_API_URL set — using a minimal curated testnet list (not real market trends). " +
        "Point STELLAR_TRENDING_API_URL at your ranking service for production-style discovery.",
      tokens: CURATED_TESTNET.slice(0, limit)
    };
  }

  throw new Error(
    "Mainnet trending requires STELLAR_TRENDING_API_URL (there is no built-in Stellar-wide trending feed)."
  );
}
