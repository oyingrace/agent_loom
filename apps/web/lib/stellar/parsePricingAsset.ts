export type ParsedAsset =
  | { kind: "native" }
  | { kind: "credit"; code: string; issuer: string };

/**
 * `native` or `XLM` → native; otherwise `CODE:ISSUER` (e.g. `USDC:GA...`).
 */
export function parsePricingAsset(asset: string): ParsedAsset {
  const t = asset.trim();
  if (t === "native" || t === "XLM") {
    return { kind: "native" };
  }
  const colon = t.indexOf(":");
  if (colon <= 0 || colon === t.length - 1) {
    throw new Error("Invalid asset: use native, XLM, or CODE:ISSUER");
  }
  return {
    kind: "credit",
    code: t.slice(0, colon).trim(),
    issuer: t.slice(colon + 1).trim()
  };
}
