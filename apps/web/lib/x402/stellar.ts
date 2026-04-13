import type { NextRequest } from "next/server";
import type { InferSelectModel } from "drizzle-orm";
import type { apiProxies } from "@agent-loom/database";
import { decodePaymentHeader, useFacilitator } from "x402-stellar";
import type {
  PaymentPayload,
  PaymentRequirements
} from "x402-stellar/types";

/** Coinbase-compatible Stellar x402 facilitator (see https://developers.stellar.org/docs/build/agentic-payments/x402) */
export const DEFAULT_X402_FACILITATOR_URL =
  "https://facilitator.stellar-x402.org";

/**
 * Protocol version advertised in 402 responses. Coinbase lists `stellar:testnet`
 * under x402 v2 on https://www.x402.org/facilitator/supported
 */
export const X402_RESPONSE_VERSION = 2;

export function getFacilitatorUrl(): string {
  return (
    process.env.X402_FACILITATOR_URL?.trim() || DEFAULT_X402_FACILITATOR_URL
  );
}

export function getX402StellarNetwork():
  | "stellar-testnet"
  | "stellar" {
  return process.env.STELLAR_NETWORK === "public" ? "stellar" : "stellar-testnet";
}

type ProxyRow = InferSelectModel<typeof apiProxies>;

/**
 * Payment requirements for this proxied resource (must match what the client
 * signed; `resource` is the full gateway URL for this request).
 */
export function buildProxyPaymentRequirements(
  request: NextRequest,
  proxy: ProxyRow
): PaymentRequirements {
  const network = getX402StellarNetwork();
  const resource = new URL(request.url).toString();
  const sponsored = network === "stellar-testnet";

  return {
    scheme: "exact",
    network,
    maxAmountRequired: proxy.pricingAmount,
    resource,
    description: proxy.name,
    mimeType: "application/json",
    outputSchema: null,
    payTo: proxy.payoutAddress,
    maxTimeoutSeconds: 600,
    asset: proxy.pricingAsset.trim(),
    extra: {
      proxyId: proxy.id,
      ...(sponsored ? { areFeesSponsored: true } : {})
    }
  };
}

export type ParsedProxyPayment =
  | { kind: "x402"; payload: PaymentPayload }
  | { kind: "legacy"; txHash: string; paymentNonce: string };

/**
 * `X-PAYMENT`: legacy JSON `{"txHash","paymentNonce"}` OR base64-encoded
 * x402 `PaymentPayload` (per `x402-stellar` / Coinbase facilitator).
 */
export function parseProxyPaymentHeader(
  raw: string | null
): ParsedProxyPayment | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();

  try {
    const obj = JSON.parse(t) as { txHash?: string; paymentNonce?: string };
    if (
      typeof obj.txHash === "string" &&
      typeof obj.paymentNonce === "string" &&
      obj.txHash.length > 0 &&
      obj.paymentNonce.length > 0
    ) {
      return {
        kind: "legacy",
        txHash: obj.txHash.trim(),
        paymentNonce: obj.paymentNonce.trim()
      };
    }
  } catch {
    // not JSON — try x402 base64
  }

  try {
    const decoded = decodePaymentHeader(t) as PaymentPayload;
    if (
      decoded &&
      typeof decoded === "object" &&
      decoded.scheme === "exact" &&
      decoded.payload
    ) {
      return { kind: "x402", payload: decoded };
    }
  } catch {
    return null;
  }

  return null;
}

function facilitatorClient() {
  const url = getFacilitatorUrl();
  const apiKey = process.env.X402_FACILITATOR_API_KEY?.trim();

  if (apiKey) {
    return useFacilitator({
      url,
      createAuthHeaders: async () => ({
        verify: { Authorization: `Bearer ${apiKey}` },
        settle: { Authorization: `Bearer ${apiKey}` },
        supported: { Authorization: `Bearer ${apiKey}` }
      })
    });
  }

  return useFacilitator({ url });
}

export async function verifyAndSettleX402Payment(params: {
  payload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}): Promise<
  | { ok: true; payer?: string; settlementTx: string }
  | { ok: false; reason: string }
> {
  const { verify, settle } = facilitatorClient();

  let verified;
  try {
    verified = await verify(params.payload, params.paymentRequirements);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "verify_failed"
    };
  }

  if (!verified.isValid) {
    return {
      ok: false,
      reason: verified.invalidReason ?? "invalid_payment"
    };
  }

  let settled;
  try {
    settled = await settle(params.payload, params.paymentRequirements);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "settle_failed"
    };
  }

  if (!settled.success) {
    return {
      ok: false,
      reason: settled.errorReason ?? "settle_rejected"
    };
  }

  return {
    ok: true,
    payer: settled.payer ?? verified.payer,
    settlementTx: settled.transaction
  };
}
