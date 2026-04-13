import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-base";
import { buildAuthMessage } from "./authMessage";
import {
  sep53MessageHash,
  verifyAuthMessageSignature
} from "./verifySignature";

describe("Stellar auth message + signature", () => {
  it("accepts a valid SEP-0053 Ed25519 signature (same as Stellar Wallets Kit / Freighter)", () => {
    const kp = Keypair.random();
    const accountAddress = kp.publicKey();
    const nonce = "test-nonce-uuid";
    const domain = "localhost";
    const message = buildAuthMessage({ nonce, accountAddress, domain });
    const sigBuf = kp.sign(sep53MessageHash(message));
    const signature = sigBuf.toString("base64");

    expect(
      verifyAuthMessageSignature({
        accountAddress,
        messageUtf8: message,
        signature
      })
    ).toBe(true);
  });

  it("rejects wrong message bytes", () => {
    const kp = Keypair.random();
    const accountAddress = kp.publicKey();
    const message = buildAuthMessage({
      nonce: "a",
      accountAddress,
      domain: "localhost"
    });
    const sigBuf = kp.sign(sep53MessageHash(message));
    const signature = sigBuf.toString("base64");

    expect(
      verifyAuthMessageSignature({
        accountAddress,
        messageUtf8: message + "\n",
        signature
      })
    ).toBe(false);
  });
});
