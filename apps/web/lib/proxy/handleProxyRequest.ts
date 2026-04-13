import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiProxies, requestLogs } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { proxyPaymentNonceRepository } from "@/lib/repositories";
import { parsePricingAsset } from "@/lib/stellar/parsePricingAsset";
import { verifyHorizonPaymentTx } from "@/lib/stellar/verifyHorizonPayment";
import {
  acquireTxLock,
  isTxUsed,
  markTxUsed,
  releaseTxLock
} from "@/lib/proxy/paymentReplay";
import {
  extractVariables,
  validateVariables,
  type VariableDefinition
} from "@/lib/proxy/variables";
import { forwardToTarget } from "./forwardToTarget";
import {
  buildProxyPaymentRequirements,
  parseProxyPaymentHeader,
  verifyAndSettleX402Payment,
  X402_RESPONSE_VERSION
} from "@/lib/x402/stellar";

const PROXY_TIMEOUT_BODY_BYTES = 2 * 1024 * 1024;

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

function includeLegacyMemo402(): boolean {
  return process.env.X402_INCLUDE_LEGACY_MEMO_402 !== "false";
}

async function logRequest(params: {
  proxyId: string;
  statusCode: number;
  statusText: string;
  paymentReference: string | null;
  requestSummary: Record<string, unknown>;
  responseSummary: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(requestLogs).values({
    proxyId: params.proxyId,
    statusCode: params.statusCode,
    statusText: params.statusText,
    paymentReference: params.paymentReference,
    requestPayload: params.requestSummary,
    responsePayload: params.responseSummary
  });
}

export async function handleProxyRequest(
  request: NextRequest,
  routeId: string
): Promise<Response> {
  const idOrSlug = routeId;
  let proxyIdForLog = idOrSlug;
  let paymentRef: string | null = null;

  try {
    const db = getDb();
    const proxyRow = await db
      .select()
      .from(apiProxies)
      .where(
        isUuid(idOrSlug)
          ? eq(apiProxies.id, idOrSlug)
          : eq(apiProxies.slug, idOrSlug)
      )
      .limit(1);

    const proxy = proxyRow[0];
    if (!proxy) {
      return NextResponse.json({ error: "Proxy not found" }, { status: 404 });
    }

    proxyIdForLog = proxy.id;

    if (!proxy.isActive) {
      return NextResponse.json({ error: "Proxy is not active" }, { status: 403 });
    }

    let requestBodyText: string | null = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      requestBodyText = await request.text();
      const byteLength = new TextEncoder().encode(requestBodyText).byteLength;
      if (byteLength > PROXY_TIMEOUT_BODY_BYTES) {
        await logRequest({
          proxyId: proxy.id,
          statusCode: 413,
          statusText: "Payload Too Large",
          paymentReference: null,
          requestSummary: { method: request.method },
          responseSummary: { error: "body_too_large" }
        });
        return NextResponse.json({ error: "Request body too large" }, { status: 413 });
      }
    }

    const url = request.nextUrl;
    const extractedVariables = extractVariables(
      request.headers,
      url.searchParams,
      requestBodyText ?? undefined
    );

    const variablesSchema = (
      Array.isArray(proxy.variablesSchema) ? proxy.variablesSchema : []
    ) as unknown as VariableDefinition[];

    if (variablesSchema.length > 0) {
      const validation = validateVariables(variablesSchema, extractedVariables);
      if (!validation.valid) {
        await logRequest({
          proxyId: proxy.id,
          statusCode: 400,
          statusText: "Bad Request",
          paymentReference: null,
          requestSummary: {
            method: request.method,
            error: "variable_validation",
            details: validation.errors
          },
          responseSummary: {}
        });
        return NextResponse.json(
          {
            error: "Variable validation failed",
            details: validation.errors,
            requiredVariables: variablesSchema
              .filter((v) => v.required)
              .map((v) => ({
                name: v.name,
                type: v.type,
                description: v.description
              }))
          },
          { status: 400 }
        );
      }
    }

    const paymentRequirements = buildProxyPaymentRequirements(request, proxy);

    const paymentHeader = request.headers.get("X-PAYMENT");
    const parsed = parseProxyPaymentHeader(paymentHeader);

    if (!parsed) {
      const body: Record<string, unknown> = {
        x402Version: X402_RESPONSE_VERSION,
        error: "payment_required",
        accepts: [paymentRequirements],
        docs: "https://developers.stellar.org/docs/build/agentic-payments/x402"
      };

      if (includeLegacyMemo402()) {
        const nonce = await proxyPaymentNonceRepository.generate();
        body.legacyMemoPayment = {
          scheme: "stellar_horizon_memo_text",
          proxyId: proxy.id,
          paymentNonce: nonce,
          stellar: {
            asset: proxy.pricingAsset,
            amount: proxy.pricingAmount,
            destination: proxy.payoutAddress,
            memo: { type: "MEMO_TEXT", maxLength: 28, value: nonce },
            instructions:
              "Legacy path: pay with TEXT memo, then retry with header X-PAYMENT: {\"txHash\":\"...\",\"paymentNonce\":\"...\"}"
          },
          horizonUrl: process.env.STELLAR_HORIZON_URL ?? null
        };
      }

      await logRequest({
        proxyId: proxy.id,
        statusCode: 402,
        statusText: "Payment Required",
        paymentReference: null,
        requestSummary: { method: request.method, path: request.nextUrl.pathname },
        responseSummary: { error: "payment_required" }
      });

      return NextResponse.json(body, {
        status: 402,
        headers: {
          "Cache-Control": "no-store"
        }
      });
    }

    if (parsed.kind === "x402") {
      paymentRef = parsed.payload.payload?.signedTxXdr?.slice(0, 32) ?? "x402";

      const settled = await verifyAndSettleX402Payment({
        payload: parsed.payload,
        paymentRequirements
      });

      if (!settled.ok) {
        await logRequest({
          proxyId: proxy.id,
          statusCode: 402,
          statusText: "x402 payment failed",
          paymentReference: null,
          requestSummary: { method: request.method },
          responseSummary: { error: "x402_verify_settle", reason: settled.reason }
        });
        return NextResponse.json(
          { error: "Payment verification failed", reason: settled.reason },
          { status: 402 }
        );
      }

      const txKey = settled.settlementTx;
      paymentRef = txKey;

      if (await isTxUsed(txKey)) {
        await logRequest({
          proxyId: proxy.id,
          statusCode: 402,
          statusText: "Transaction already used",
          paymentReference: txKey,
          requestSummary: { method: request.method },
          responseSummary: { error: "tx_already_used" }
        });
        return NextResponse.json(
          { error: "This payment was already used for a paid request" },
          { status: 402 }
        );
      }

      const locked = await acquireTxLock(txKey);
      if (!locked) {
        return NextResponse.json(
          { error: "Payment is being processed; retry shortly" },
          { status: 429 }
        );
      }

      try {
        const upstream = await forwardToTarget({
          proxy,
          incomingRequest: request,
          requestBodyText,
          extractedVariables
        });

        const ok = upstream.status >= 200 && upstream.status < 300;

        if (ok) {
          await markTxUsed(txKey);
        }

        const resHeaders = new Headers(upstream.headers);
        resHeaders.delete("transfer-encoding");

        await logRequest({
          proxyId: proxy.id,
          statusCode: upstream.status,
          statusText: upstream.statusText,
          paymentReference: txKey,
          requestSummary: {
            method: request.method,
            payer: settled.payer,
            payment: "x402"
          },
          responseSummary: {
            upstreamStatus: upstream.status,
            charged: ok
          }
        });

        return new NextResponse(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: resHeaders
        });
      } catch (e) {
        await logRequest({
          proxyId: proxy.id,
          statusCode: 502,
          statusText: "Bad Gateway",
          paymentReference: txKey,
          requestSummary: { method: request.method },
          responseSummary: { error: "upstream_fetch_failed", message: String(e) }
        });
        return NextResponse.json(
          { error: "Failed to reach target API" },
          { status: 502 }
        );
      } finally {
        await releaseTxLock(txKey);
      }
    }

    const { txHash, paymentNonce } = parsed;
    paymentRef = txHash;

    const nonceOk = await proxyPaymentNonceRepository.isValid(paymentNonce);
    if (!nonceOk) {
      await logRequest({
        proxyId: proxy.id,
        statusCode: 402,
        statusText: "Invalid payment nonce",
        paymentReference: txHash,
        requestSummary: { method: request.method },
        responseSummary: { error: "invalid_or_used_payment_nonce" }
      });
      return NextResponse.json(
        { error: "Invalid or expired payment nonce" },
        { status: 402 }
      );
    }

    if (await isTxUsed(txHash)) {
      await logRequest({
        proxyId: proxy.id,
        statusCode: 402,
        statusText: "Transaction already used",
        paymentReference: txHash,
        requestSummary: { method: request.method },
        responseSummary: { error: "tx_already_used" }
      });
      return NextResponse.json(
        { error: "This transaction was already used for a paid request" },
        { status: 402 }
      );
    }

    let assetParsed;
    try {
      assetParsed = parsePricingAsset(proxy.pricingAsset);
    } catch (e) {
      return NextResponse.json(
        { error: "Proxy pricing asset is misconfigured", details: String(e) },
        { status: 500 }
      );
    }

    const verified = await verifyHorizonPaymentTx({
      txHash,
      paymentMemo: paymentNonce,
      destination: proxy.payoutAddress,
      minimumAmount: proxy.pricingAmount,
      asset: assetParsed
    });

    if (!verified.ok) {
      await logRequest({
        proxyId: proxy.id,
        statusCode: 402,
        statusText: "Payment verification failed",
        paymentReference: txHash,
        requestSummary: { method: request.method },
        responseSummary: { error: verified.reason }
      });
      return NextResponse.json(
        { error: "Payment verification failed", reason: verified.reason },
        { status: 402 }
      );
    }

    const locked = await acquireTxLock(txHash);
    if (!locked) {
      return NextResponse.json(
        { error: "Payment transaction is being processed; retry shortly" },
        { status: 429 }
      );
    }

    try {
      const upstream = await forwardToTarget({
        proxy,
        incomingRequest: request,
        requestBodyText,
        extractedVariables
      });

      const ok = upstream.status >= 200 && upstream.status < 300;

      if (ok) {
        await markTxUsed(txHash);
        await proxyPaymentNonceRepository.consume(paymentNonce);
      }

      const resHeaders = new Headers(upstream.headers);
      resHeaders.delete("transfer-encoding");

      await logRequest({
        proxyId: proxy.id,
        statusCode: upstream.status,
        statusText: upstream.statusText,
        paymentReference: txHash,
        requestSummary: {
          method: request.method,
          payer: verified.payer,
          payment: "legacy_memo"
        },
        responseSummary: {
          upstreamStatus: upstream.status,
          charged: ok
        }
      });

      return new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: resHeaders
      });
    } catch (e) {
      await logRequest({
        proxyId: proxy.id,
        statusCode: 502,
        statusText: "Bad Gateway",
        paymentReference: txHash,
        requestSummary: { method: request.method },
        responseSummary: { error: "upstream_fetch_failed", message: String(e) }
      });
      return NextResponse.json(
        { error: "Failed to reach target API" },
        { status: 502 }
      );
    } finally {
      await releaseTxLock(txHash);
    }
  } catch (error) {
    console.error("[handleProxyRequest]", error);
    try {
      await logRequest({
        proxyId: proxyIdForLog,
        statusCode: 500,
        statusText: "Internal Server Error",
        paymentReference: paymentRef,
        requestSummary: {},
        responseSummary: { error: String(error) }
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
