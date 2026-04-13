import {
  Account,
  Asset,
  Memo,
  Operation,
  TransactionBuilder
} from "@stellar/stellar-base";
import { encodePaymentHeader } from "x402-stellar";
import type { PaymentRequirements } from "x402-stellar/types";
import { STELLAR_NETWORKS } from "x402-stellar";

import { parsePricingAsset } from "@/lib/stellar/parsePricingAsset";

/** Stellar classic payment amount string (7 decimals) from stroops. */
export function stroopsToStellarAmountString(stroops: string): string {
  const n = BigInt(stroops);
  if (n < 0n) throw new Error("invalid stroops");
  const intPart = n / 10000000n;
  const frac = n % 10000000n;
  return `${intPart}.${frac.toString().padStart(7, "0")}`;
}

function assetFromRequirement(assetStr: string): Asset {
  const t = assetStr.trim();
  if (t === "native" || t === "XLM") return Asset.native();
  if (t.startsWith("C") && t.length === 56) {
    throw new Error(
      "SAC contract assets (C…) need a Soroban signing path. Use native or a classic asset (CODE:ISSUER) in the proxy price for this tester."
    );
  }
  const parsed = parsePricingAsset(assetStr);
  if (parsed.kind === "native") return Asset.native();
  return new Asset(parsed.code, parsed.issuer);
}

function horizonForNetwork(network: "stellar-testnet" | "stellar"): string {
  return STELLAR_NETWORKS[network].horizonUrl;
}

/**
 * Build a base64 `X-PAYMENT` header value (x402 `PaymentPayload`) for Stellar classic
 * native or credit-asset payments, signed by the wallet.
 */
export async function buildSignedX402PaymentHeader(params: {
  requirements: PaymentRequirements;
  payer: string;
  networkPassphrase: string;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
}): Promise<string> {
  const req = params.requirements;
  if (req.scheme !== "exact") {
    throw new Error("Unsupported x402 scheme");
  }
  const network = req.network;
  const horizonUrl = horizonForNetwork(network).replace(/\/$/, "");

  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 28);

  const acctRes = await fetch(
    `${horizonUrl}/accounts/${encodeURIComponent(params.payer)}`
  );
  if (!acctRes.ok) {
    throw new Error(
      `Failed to load payer account from Horizon (${acctRes.status})`
    );
  }
  const acctJson = (await acctRes.json()) as { sequence: string };
  const sequence = String(acctJson.sequence);

  const ledgerRes = await fetch(`${horizonUrl}/ledgers?order=desc&limit=1`);
  if (!ledgerRes.ok) throw new Error("Failed to read latest ledger");
  const ledgerJson = (await ledgerRes.json()) as {
    _embedded?: { records?: Array<{ sequence?: number }> };
  };
  const latestSeq = ledgerJson._embedded?.records?.[0]?.sequence;
  if (typeof latestSeq !== "number") throw new Error("Invalid ledger response");
  const validUntilLedger = latestSeq + 120;

  const asset = assetFromRequirement(req.asset);
  const amountStr = stroopsToStellarAmountString(req.maxAmountRequired);

  const txBuilder = new TransactionBuilder(new Account(params.payer, sequence), {
    fee: "100000",
    networkPassphrase: params.networkPassphrase
  });
  txBuilder.addMemo(Memo.text(nonce));
  txBuilder.addOperation(
    Operation.payment({
      destination: req.payTo,
      asset,
      amount: amountStr
    })
  );

  const tx = txBuilder.build();
  const signed = await params.signTransaction(tx.toXDR());

  const headerPayload = {
    x402Version: 1 as const,
    scheme: "exact" as const,
    network,
    payload: {
      signedTxXdr: signed.signedTxXdr,
      sourceAccount: params.payer,
      amount: req.maxAmountRequired,
      destination: req.payTo,
      asset: req.asset.trim(),
      validUntilLedger,
      nonce
    }
  };

  return encodePaymentHeader(headerPayload);
}

export function isX402PaymentRequirements(
  value: unknown
): value is PaymentRequirements {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    o.scheme === "exact" &&
    (o.network === "stellar-testnet" || o.network === "stellar") &&
    typeof o.maxAmountRequired === "string" &&
    typeof o.payTo === "string" &&
    typeof o.asset === "string"
  );
}
