/**
 * Minimal ranking API for Agent Loom STELLAR_TRENDING_API_URL.
 *
 * Example Loom env:
 *   STELLAR_TRENDING_API_URL=https://stellar-trending.<your-subdomain>.workers.dev/trending?network={network}&limit={limit}
 */

import { Networks } from "@stellar/stellar-base";
import {
  fetchTrendingFromHorizon,
  HORIZON_MAINNET,
  HORIZON_TESTNET,
  type TokenRow
} from "./horizonTrending";

export interface Env {
  /** JSON array: [{"rank":1,"contract":"C...","symbol":"USDC"}] or {"tokens":[...]} — overrides live Horizon when non-empty. */
  TRENDING_JSON?: string;
  /** Override Horizon base URL (default mainnet / testnet from network). */
  HORIZON_URL?: string;
}

const TESTNET_CURATED: TokenRow[] = [
  {
    rank: 1,
    symbol: "USDC",
    contract: "CBBHRKEP5M3NUDRISGLJKGHDHX3DA2CN2AZBQY6WLVUJ7VNLGSKBDUCM"
  }
];

function parseTokensFromEnv(raw: string | undefined): TokenRow[] {
  if (!raw?.trim()) return [];
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return normalizeRows(parsed);
  }
  if (parsed && typeof parsed === "object" && "tokens" in parsed) {
    const t = (parsed as { tokens: unknown }).tokens;
    return Array.isArray(t) ? normalizeRows(t) : [];
  }
  return [];
}

function normalizeRows(arr: unknown[]): TokenRow[] {
  const out: TokenRow[] = [];
  let i = 1;
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const contract = String((item as { contract?: string }).contract ?? "").trim();
    if (!contract.startsWith("C")) continue;
    const symbol =
      typeof (item as { symbol?: string }).symbol === "string"
        ? (item as { symbol: string }).symbol
        : undefined;
    const rank =
      typeof (item as { rank?: number }).rank === "number"
        ? (item as { rank: number }).rank
        : i;
    out.push({ rank, contract, symbol });
    i += 1;
  }
  return out;
}

function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-max-age": "86400"
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }

    if (url.pathname === "/" || url.pathname === "") {
      return Response.json(
        {
          ok: true,
          service: "stellar-trending",
          trending: "/trending?network=testnet&limit=5",
          mainnet_live: "/trending?network=mainnet&limit=5"
        },
        { headers: corsHeaders() }
      );
    }

    if (url.pathname !== "/trending") {
      return new Response("Not found", { status: 404, headers: corsHeaders() });
    }

    const network = (url.searchParams.get("network") || "testnet").toLowerCase();
    const limitRaw = url.searchParams.get("limit");
    const parsedLimit = parseInt(limitRaw ?? "5", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 25)
      : 5;

    const isMainnet = network === "public" || network === "mainnet";
    const isTestnet = network === "testnet";

    let tokens: TokenRow[] = [];
    let source: string;
    let horizonError: string | undefined;

    let fromEnv: TokenRow[];
    try {
      fromEnv = parseTokensFromEnv(env.TRENDING_JSON);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return Response.json(
        { error: "Invalid TRENDING_JSON", detail },
        { status: 500, headers: corsHeaders() }
      );
    }

    if (fromEnv.length > 0) {
      tokens = fromEnv;
      source = "worker_trending_json";
    } else if (isMainnet) {
      try {
        const horizonBase = (env.HORIZON_URL ?? HORIZON_MAINNET).trim();
        tokens = await fetchTrendingFromHorizon({
          horizonUrl: horizonBase,
          networkPassphrase: Networks.PUBLIC,
          resultLimit: limit
        });
        source = "horizon_mainnet_trade_frequency";
      } catch (e) {
        horizonError = e instanceof Error ? e.message : String(e);
        tokens = [];
        source = "horizon_mainnet_error";
      }
    } else if (isTestnet) {
      try {
        const horizonBase = (env.HORIZON_URL ?? HORIZON_TESTNET).trim();
        tokens = await fetchTrendingFromHorizon({
          horizonUrl: horizonBase,
          networkPassphrase: Networks.TESTNET,
          resultLimit: limit
        });
        if (tokens.length === 0) {
          tokens = TESTNET_CURATED;
          source = "worker_curated_testnet_fallback_empty_horizon";
        } else {
          source = "horizon_testnet_trade_frequency";
        }
      } catch {
        tokens = TESTNET_CURATED;
        source = "worker_curated_testnet_fallback_horizon_error";
      }
    } else {
      tokens = TESTNET_CURATED;
      source = "worker_curated_testnet";
    }

    tokens = [...tokens].sort((a, b) => a.rank - b.rank).slice(0, limit);

    const disclaimer =
      source === "worker_trending_json"
        ? "Rankings from worker TRENDING_JSON. Verify contracts and liquidity before trading."
        : source === "horizon_mainnet_trade_frequency" ||
            source === "horizon_testnet_trade_frequency"
          ? "Ranked by frequency in recent Horizon trades (not 24h USD volume). Contract ids are Stellar Asset Contracts (SAC) for classic assets."
          : source === "horizon_mainnet_error"
            ? `Mainnet Horizon fetch failed: ${horizonError ?? "unknown"}. Set TRENDING_JSON or check HORIZON_URL.`
            : source.startsWith("worker_curated")
              ? "Curated fallback list — use live Horizon path or TRENDING_JSON for production."
              : "Demo list — verify liquidity before trading.";

    return Response.json(
      {
        source,
        network,
        disclaimer,
        tokens,
        ...(horizonError ? { horizonError } : {})
      },
      { headers: corsHeaders() }
    );
  }
};
