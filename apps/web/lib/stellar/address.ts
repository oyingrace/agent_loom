import { StrKey } from "@stellar/stellar-base";

/** Shape check for 56-char Stellar strkeys (`G…` account or `C…` contract). */
const STELLAR_STRKEY_RE = /^[GC][A-Z2-7]{55}$/;

export function isValidStellarStrkeyAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!STELLAR_STRKEY_RE.test(trimmed)) {
    return false;
  }
  try {
    if (trimmed.startsWith("G")) {
      StrKey.decodeEd25519PublicKey(trimmed);
    } else {
      StrKey.decodeContract(trimmed);
    }
    return true;
  } catch {
    return false;
  }
}
