import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { validateBearerToken } from "@/lib/auth/bearerToken";
import { getCurrentUser } from "@/lib/auth/session";
import { executeSoroswapAggregatorSwap } from "@/lib/stellar/soroswapAggregator";

type Network = "testnet" | "public";

function parseNetwork(): Network {
  return process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
}

/**
 * POST /api/soroswap/aggregator-swap
 * Soroswap HTTP API: quote → build → sign with hot wallet → /send.
 * Requires SOROSWAP_API_KEY, WORKFLOW_HOT_WALLET_SECRET, and a funded hot wallet.
 */
export async function POST(request: NextRequest) {
  const sessionUser = await getCurrentUser();
  const bearer = await validateBearerToken(request.headers.get("authorization"));
  const user = sessionUser ?? bearer?.user ?? null;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (bearer) {
    const ok =
      bearer.scopes.includes("mcp:tools") ||
      bearer.scopes.includes("stellar:soroswap");
    if (!ok) {
      return NextResponse.json(
        {
          error: "insufficient_scope",
          required: "mcp:tools or stellar:soroswap"
        },
        { status: 403 }
      );
    }
  }

  const body = (await request.json()) as {
    asset_in?: string;
    asset_out?: string;
    amount_in?: string;
    recipient?: string;
    trade_type?: "EXACT_IN" | "EXACT_OUT";
    protocols?: string[];
    slippage_bps?: number;
    network?: Network;
  };

  const network = body.network ?? parseNetwork();
  const assetIn = body.asset_in?.trim();
  const assetOut = body.asset_out?.trim();
  const amountIn = body.amount_in?.trim();

  if (!assetIn?.startsWith("C") || !assetOut?.startsWith("C")) {
    return NextResponse.json(
      {
        error: "asset_in and asset_out must be Soroban contract ids (C...)"
      },
      { status: 400 }
    );
  }

  if (!amountIn) {
    return NextResponse.json(
      { error: "amount_in required (integer string, smallest units)" },
      { status: 400 }
    );
  }

  try {
    BigInt(amountIn);
  } catch {
    return NextResponse.json(
      { error: "amount_in must be an integer string" },
      { status: 400 }
    );
  }

  const recipient =
    (body.recipient?.trim() || user.accountAddress || "").trim();
  if (!recipient || !recipient.startsWith("G")) {
    return NextResponse.json(
      { error: "recipient must be G... or set user accountAddress" },
      { status: 400 }
    );
  }

  let hotPk: string;
  try {
    const secret =
      process.env.WORKFLOW_HOT_WALLET_SECRET ??
      process.env.WORKFLOW_HOT_WALLET_SEED ??
      "";
    if (!secret) {
      return NextResponse.json(
        {
          error:
            "WORKFLOW_HOT_WALLET_SECRET is required for aggregator swaps (or WORKFLOW_HOT_WALLET_SEED)."
        },
        { status: 500 }
      );
    }
    hotPk = Keypair.fromSecret(secret).publicKey();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const slippageBps =
    typeof body.slippage_bps === "number" && Number.isFinite(body.slippage_bps)
      ? Math.min(Math.max(Math.floor(body.slippage_bps), 0), 5000)
      : undefined;

  try {
    const { txHash, quote, send } = await executeSoroswapAggregatorSwap({
      network,
      assetIn,
      assetOut,
      amount: amountIn,
      from: hotPk,
      to: recipient,
      tradeType: body.trade_type,
      protocols: body.protocols,
      slippageBps
    });

    return NextResponse.json({
      ok: true,
      mode: "soroswap_http_aggregator",
      txHash,
      network,
      from: hotPk,
      to: recipient,
      quote,
      send,
      docs: "https://docs.soroswap.finance/soroswap-api"
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
