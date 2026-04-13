import { type ParsedAsset } from "./parsePricingAsset";
import { horizonFetchJson } from "./horizonFetch";

type HorizonTx = {
  successful?: boolean;
  memo_type?: string;
  memo?: string;
};

type HorizonOp = {
  type?: string;
  type_i?: number;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
};

type HorizonOpPage = {
  _embedded?: { records?: HorizonOp[] };
};

function amountMeetsMinimum(actual: string, minimum: string): boolean {
  const a = Number.parseFloat(actual);
  const b = Number.parseFloat(minimum);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a + 1e-12 >= b;
}

function assetMatchesOp(
  parsed: ParsedAsset,
  op: HorizonOp
): boolean {
  if (parsed.kind === "native") {
    return op.asset_type === "native";
  }
  return (
    (op.asset_type === "credit_alphanum4" ||
      op.asset_type === "credit_alphanum12") &&
    op.asset_code === parsed.code &&
    op.asset_issuer === parsed.issuer
  );
}

export type VerifyHorizonPaymentResult =
  | { ok: true; payer: string }
  | { ok: false; reason: string };

/**
 * Verify a successful Stellar payment that includes a text memo binding
 * and pays at least `minimumAmount` to `destination` for `asset`.
 */
export async function verifyHorizonPaymentTx(params: {
  txHash: string;
  paymentMemo: string;
  destination: string;
  minimumAmount: string;
  asset: ParsedAsset;
}): Promise<VerifyHorizonPaymentResult> {
  const { txHash, paymentMemo, destination, minimumAmount, asset } = params;

  let tx: HorizonTx;
  try {
    tx = await horizonFetchJson<HorizonTx>(`/transactions/${txHash}`);
  } catch {
    return { ok: false, reason: "transaction_not_found" };
  }

  if (!tx.successful) {
    return { ok: false, reason: "transaction_not_successful" };
  }

  if ((tx.memo_type ?? "").toLowerCase() !== "text") {
    return { ok: false, reason: "memo_must_be_text" };
  }

  if ((tx.memo ?? "").trim() !== paymentMemo.trim()) {
    return { ok: false, reason: "memo_mismatch" };
  }

  let ops: HorizonOpPage;
  try {
    ops = await horizonFetchJson<HorizonOpPage>(
      `/transactions/${txHash}/operations`
    );
  } catch {
    return { ok: false, reason: "operations_not_found" };
  }

  const records = ops._embedded?.records ?? [];
  for (const op of records) {
    const isPayment = op.type === "payment" || op.type_i === 1;
    if (!isPayment) {
      continue;
    }
    if ((op.to ?? "").trim() !== destination.trim()) {
      continue;
    }
    if (!assetMatchesOp(asset, op)) {
      continue;
    }
    if (!op.amount || !amountMeetsMinimum(op.amount, minimumAmount)) {
      continue;
    }
    const payer = (op.from ?? "").trim();
    if (!payer) {
      continue;
    }
    return { ok: true, payer };
  }

  return { ok: false, reason: "no_matching_payment_operation" };
}
