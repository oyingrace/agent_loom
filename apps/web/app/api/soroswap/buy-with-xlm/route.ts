import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { validateBearerToken } from "@/lib/auth/bearerToken";
import { getCurrentUser } from "@/lib/auth/session";
import { buildSwapExactTokensForTokensArgs } from "@/lib/stellar/buildSoroswapSwapArgs";
import { sorobanSimulateAndSubmit } from "@/lib/stellar/sorobanSimulateAndSubmit";
import { getSoroswapRouterContractId } from "@/lib/stellar/soroswapAddresses";
import { getNativeSacContractId } from "@/lib/stellar/nativeSac";
import {
  applySlippageMin,
  estimateSoroswapRouterAmountOut
} from "@/lib/stellar/estimateSoroswapRouterOut";
import { fetchTrendingStellarTokens } from "@/lib/stellar/fetchTrendingStellarTokens";
import { xlmHumanStringToStroops } from "@/lib/stellar/xlmAmount";
import { executeSoroswapAggregatorSwap } from "@/lib/stellar/soroswapAggregator";

type Network = "testnet" | "public";

function parseNetwork(): Network {
  return process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
}

/**
 * POST /api/soroswap/buy-with-xlm
 * Spend wrapped native XLM (SAC) from the **hot wallet** through Soroswap router to buy `token_out`.
 * Recipient defaults to the authenticated user's Stellar address.
 *
 * Either pass `token_out_contract` OR `trend_rank` (1-based index from /api/stellar/trending).
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
    xlm_amount?: string;
    token_out_contract?: string;
    trend_rank?: number;
    slippage_bps?: number;
    recipient?: string;
    network?: Network;
    /** Use Soroswap HTTP aggregator (multi-protocol); requires SOROSWAP_API_KEY. */
    use_aggregator?: boolean;
    protocols?: string[];
  };

  const network = body.network ?? parseNetwork();
  const xlmAmountRaw = body.xlm_amount?.trim();
  if (!xlmAmountRaw) {
    return NextResponse.json(
      { error: "xlm_amount required (human units, e.g. \"10\")" },
      { status: 400 }
    );
  }

  let amountIn: bigint;
  try {
    amountIn = xlmHumanStringToStroops(xlmAmountRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const slippageBps =
    typeof body.slippage_bps === "number" && Number.isFinite(body.slippage_bps)
      ? Math.min(Math.max(Math.floor(body.slippage_bps), 0), 5000)
      : 150;

  const nativeSac = getNativeSacContractId(network);
  let tokenOut = body.token_out_contract?.trim() ?? "";

  if (body.trend_rank !== undefined) {
    const rank = Math.floor(body.trend_rank);
    if (rank < 1) {
      return NextResponse.json({ error: "trend_rank must be >= 1" }, { status: 400 });
    }
    const trending = await fetchTrendingStellarTokens({ network, limit: rank });
    const pick = trending.tokens[rank - 1];
    if (!pick) {
      return NextResponse.json(
        { error: `No trending token at rank ${rank}`, trending: trending.tokens },
        { status: 400 }
      );
    }
    tokenOut = pick.contract;
    if (tokenOut === nativeSac) {
      return NextResponse.json(
        { error: "Selected trending token is native SAC; pick another rank or pass token_out_contract." },
        { status: 400 }
      );
    }
  }

  if (!tokenOut.startsWith("C")) {
    return NextResponse.json(
      {
        error:
          "token_out_contract (C...) or trend_rank required — Soroban token contract id for the asset to buy."
      },
      { status: 400 }
    );
  }

  if (tokenOut === nativeSac) {
    return NextResponse.json(
      { error: "token_out_contract must not be the native XLM SAC (nothing to buy)." },
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

  const path = [nativeSac, tokenOut];
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const router = getSoroswapRouterContractId(network);

  try {
    if (body.use_aggregator === true) {
      const secret =
        process.env.WORKFLOW_HOT_WALLET_SECRET ??
        process.env.WORKFLOW_HOT_WALLET_SEED ??
        "";
      if (!secret) {
        return NextResponse.json(
          {
            error:
              "WORKFLOW_HOT_WALLET_SECRET required for aggregator path (or WORKFLOW_HOT_WALLET_SEED)."
          },
          { status: 500 }
        );
      }
      const hotPk = Keypair.fromSecret(secret).publicKey();
      const { txHash, quote, send } = await executeSoroswapAggregatorSwap({
        network,
        assetIn: nativeSac,
        assetOut: tokenOut,
        amount: amountIn.toString(),
        from: hotPk,
        to: recipient,
        protocols: body.protocols,
        slippageBps: slippageBps
      });

      return NextResponse.json({
        ok: true,
        mode: "soroswap_http_aggregator",
        txHash,
        network,
        path,
        amount_in_stroops: amountIn.toString(),
        slippage_bps: slippageBps,
        recipient,
        from: hotPk,
        quote,
        send,
        docs: "https://docs.soroswap.finance/soroswap-api"
      });
    }

    const { amountOut } = await estimateSoroswapRouterAmountOut({
      amountIn,
      path,
      recipient,
      deadline,
      network
    });

    const amountOutMin = applySlippageMin(amountOut, slippageBps);

    const args = buildSwapExactTokensForTokensArgs({
      amountIn,
      amountOutMin,
      path,
      to: recipient,
      deadline
    });

    const { txHash } = await sorobanSimulateAndSubmit({
      contractId: router,
      functionName: "swap_exact_tokens_for_tokens",
      args,
      network
    });

    return NextResponse.json({
      ok: true,
      txHash,
      network,
      router,
      path,
      amount_in_stroops: amountIn.toString(),
      estimated_amount_out: amountOut.toString(),
      amount_out_min: amountOutMin.toString(),
      slippage_bps: slippageBps,
      recipient,
      note:
        "Hot wallet must hold wrapped XLM on the native SAC and have router allowance. Output is approximate until confirmed on-chain."
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
