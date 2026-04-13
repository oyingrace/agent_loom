import { NextRequest, NextResponse } from "next/server";
import { fetchTrendingStellarTokens } from "@/lib/stellar/fetchTrendingStellarTokens";

/**
 * GET /api/stellar/trending?limit=5
 * Public: ranked Soroban token contract IDs for agent discovery (no global Stellar "CoinGecko").
 */
export async function GET(request: NextRequest) {
  const network = process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const parsed = parseInt(limitRaw ?? "5", 10);
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 25) : 5;

  try {
    const data = await fetchTrendingStellarTokens({ network, limit });
    return NextResponse.json({ network, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
