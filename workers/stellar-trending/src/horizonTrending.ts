import { Asset, Networks } from "@stellar/stellar-base";

export type TokenRow = { rank: number; contract: string; symbol?: string };

/** Horizon trade record (subset). */
type HorizonTrade = {
  base_asset_type?: string;
  base_asset_code?: string;
  base_asset_issuer?: string;
  counter_asset_type?: string;
  counter_asset_code?: string;
  counter_asset_issuer?: string;
};

function isCreditAsset(type: string | undefined): type is "credit_alphanum4" | "credit_alphanum12" {
  return type === "credit_alphanum4" || type === "credit_alphanum12";
}

function bumpAsset(
  counts: Map<string, { code: string; issuer: string; n: number }>,
  type: string | undefined,
  code: string | undefined,
  issuer: string | undefined
): void {
  if (!isCreditAsset(type)) return;
  if (!code || !issuer) return;
  const key = `${code}:${issuer}`;
  const cur = counts.get(key) ?? { code, issuer, n: 0 };
  cur.n += 1;
  counts.set(key, cur);
}

/**
 * Rank Stellar **classic** assets by how often they appear in recent Horizon trades,
 * then map each to its **Stellar Asset Contract** id (`C...`) for Soroban swaps.
 *
 * This is a volume *proxy* (trade count in the last N trades), not a 24h volume leaderboard.
 */
export async function fetchTrendingFromHorizon(params: {
  horizonUrl: string;
  networkPassphrase: string;
  tradeLimit?: number;
  resultLimit: number;
}): Promise<TokenRow[]> {
  const tradeLimit = Math.min(params.tradeLimit ?? 200, 200);
  const url = `${params.horizonUrl.replace(/\/$/, "")}/trades?order=desc&limit=${tradeLimit}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Horizon trades failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    _embedded?: { records?: HorizonTrade[] };
  };
  const records = data._embedded?.records ?? [];
  const counts = new Map<string, { code: string; issuer: string; n: number }>();

  for (const t of records) {
    bumpAsset(counts, t.base_asset_type, t.base_asset_code, t.base_asset_issuer);
    bumpAsset(counts, t.counter_asset_type, t.counter_asset_code, t.counter_asset_issuer);
  }

  const sorted = [...counts.values()].sort((a, b) => b.n - a.n);
  const top = sorted.slice(0, params.resultLimit);

  const out: TokenRow[] = [];
  let rank = 1;
  for (const s of top) {
    try {
      const asset = new Asset(s.code, s.issuer);
      const contract = asset.contractId(params.networkPassphrase);
      out.push({ rank, symbol: s.code, contract });
      rank += 1;
    } catch {
      // Skip invalid asset pairs
    }
  }
  return out;
}

export const HORIZON_MAINNET = "https://horizon.stellar.org";
export const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
