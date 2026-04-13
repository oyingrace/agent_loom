/**
 * Display Stellar proxy pricing (asset code + minimum amount string).
 */
export function formatLoomPrice(pricingAsset: string, pricingAmount: string): string {
  const asset = pricingAsset.trim() || "native";
  const amt = pricingAmount.trim();
  const label = asset === "native" || asset === "XLM" ? "XLM" : asset;
  return `${amt} ${label}`;
}
