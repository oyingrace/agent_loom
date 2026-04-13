import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/auth/bearerToken";
import { getCurrentUser } from "@/lib/auth/session";
import { buildSwapExactTokensForTokensArgs } from "@/lib/stellar/buildSoroswapSwapArgs";
import { sorobanSimulateAndSubmit } from "@/lib/stellar/sorobanSimulateAndSubmit";
import { getSoroswapRouterContractId } from "@/lib/stellar/soroswapAddresses";

type Network = "testnet" | "public";

function parseNetwork(): Network {
  return process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
}

/**
 * POST /api/soroswap/swap
 * Soroswap AMM **direct** router swap (`swap_exact_tokens_for_tokens`).
 *
 * The server signs with `WORKFLOW_HOT_WALLET_*` — that account must hold `amount_in`
 * of the first path token and must have approved the Soroswap router (SEP-41 allowance).
 * Output is sent to `recipient` (defaults to the authenticated user's Stellar address).
 *
 * Docs: https://docs.soroswap.finance/smart-contracts/01-protocol-overview/03-technical-reference/deployed-addresses
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
    amount_in?: string;
    amount_out_min?: string;
    path?: string[];
    recipient?: string;
    deadline_unix?: number;
    network?: Network;
  };

  const network = body.network ?? parseNetwork();
  const amountIn = body.amount_in?.trim();
  const amountOutMin = body.amount_out_min?.trim();
  const path = body.path;

  if (!amountIn || !amountOutMin || !path || !Array.isArray(path) || path.length < 2) {
    return NextResponse.json(
      {
        error: "Invalid body",
        expected: {
          amount_in: "string (integer, smallest units)",
          amount_out_min: "string (integer)",
          path: "string[] (token contract C... in order, first = in)",
          recipient: "optional G... (defaults to user account)",
          deadline_unix: "optional number (seconds)",
          network: "optional testnet | public"
        }
      },
      { status: 400 }
    );
  }

  let amountInBn: bigint;
  let amountOutMinBn: bigint;
  try {
    amountInBn = BigInt(amountIn);
    amountOutMinBn = BigInt(amountOutMin);
  } catch {
    return NextResponse.json(
      { error: "amount_in and amount_out_min must be integer strings" },
      { status: 400 }
    );
  }

  const recipient =
    (body.recipient?.trim() || user.accountAddress || "").trim();
  if (!recipient || !recipient.startsWith("G")) {
    return NextResponse.json(
      { error: "recipient must be a Stellar account (G...) or set user accountAddress" },
      { status: 400 }
    );
  }

  const deadline =
    body.deadline_unix ??
    Math.floor(Date.now() / 1000) + 600;

  const router = getSoroswapRouterContractId(network);

  try {
    const args = buildSwapExactTokensForTokensArgs({
      amountIn: amountInBn,
      amountOutMin: amountOutMinBn,
      path,
      to: recipient,
      deadline: BigInt(deadline)
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
      docs: "https://docs.soroswap.finance/"
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
