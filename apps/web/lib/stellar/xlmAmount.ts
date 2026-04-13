/** Convert human XLM (7 decimals) string to stroops. */
export function xlmHumanStringToStroops(s: string): bigint {
  const t = s.trim();
  const neg = t.startsWith("-");
  const u = neg ? t.slice(1).trim() : t;
  const m = /^(\d+)(?:\.(\d{0,7}))?$/.exec(u);
  if (!m || u === "") {
    throw new Error('xlm_amount must be a positive decimal string (e.g. "10" or "0.5")');
  }
  if (neg) {
    throw new Error("xlm_amount must be positive");
  }
  const wholePart = m[1];
  if (wholePart === undefined) {
    throw new Error('xlm_amount must be a positive decimal string (e.g. "10" or "0.5")');
  }
  const whole = BigInt(wholePart);
  let frac = m[2] ?? "";
  frac = (frac + "0000000").slice(0, 7);
  const stroops = whole * 10_000_000n + BigInt(frac || "0");
  if (stroops <= 0n) {
    throw new Error("xlm_amount must be positive");
  }
  return stroops;
}
