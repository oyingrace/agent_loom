import { createHash } from "crypto";

import { Keypair, StrKey } from "@stellar/stellar-base";

/** SEP-0053 prefix; wallets sign SHA-256(prefix + UTF-8 message), not raw message bytes. */
const SEP53_MESSAGE_PREFIX = Buffer.from("Stellar Signed Message:\n", "utf8");

/**
 * SHA-256 digest that Stellar wallets sign for `signMessage` (SEP-0053).
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
 */
export function sep53MessageHash(messageUtf8: string): Buffer {
  const messageBytes = Buffer.from(messageUtf8, "utf8");
  return createHash("sha256")
    .update(Buffer.concat([SEP53_MESSAGE_PREFIX, messageBytes]))
    .digest();
}

/** True if `address` decodes as a Stellar Ed25519 public key strkey (`G…`). */
export function isEd25519PublicKeyStrkey(address: string): boolean {
  try {
    StrKey.decodeEd25519PublicKey(address.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Decode Ed25519 signature from base64 or 128-char hex (optional `0x`).
 */
export function decodeSignaturePayload(input: string): Buffer | null {
  const t = input.trim();
  if (/^(0x)?[0-9a-fA-F]{128}$/.test(t)) {
    const hex = t.startsWith("0x") ? t.slice(2) : t;
    return Buffer.from(hex, "hex");
  }
  try {
    const buf = Buffer.from(t, "base64");
    if (buf.length === 64) return buf;
  } catch {
    return null;
  }
  return null;
}

/**
 * Verify an Ed25519 signature over UTF-8 `messageUtf8` for Stellar account `accountAddress` (`G…`).
 */
export function verifyAuthMessageSignature(params: {
  accountAddress: string;
  messageUtf8: string;
  signature: string;
}): boolean {
  const account = params.accountAddress.trim();
  if (!isEd25519PublicKeyStrkey(account)) {
    return false;
  }
  const sig = decodeSignaturePayload(params.signature);
  if (!sig) {
    return false;
  }
  try {
    const kp = Keypair.fromPublicKey(account);
    const messageHash = sep53MessageHash(params.messageUtf8);
    return kp.verify(messageHash, sig);
  } catch {
    return false;
  }
}
