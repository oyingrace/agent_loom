/**
 * Canonical UTF-8 message passed to wallet `signMessage` for `POST /api/auth/session`.
 * Wallets apply SEP-0053 (prefix + this string, SHA-256, then Ed25519).
 * Any change to format requires bumping `AUTH_MESSAGE_VERSION`.
 */
export const AUTH_MESSAGE_VERSION = "agent_loom auth v1";

export function buildAuthMessage(params: {
  nonce: string;
  accountAddress: string;
  domain: string;
}): string {
  return [
    AUTH_MESSAGE_VERSION,
    `nonce: ${params.nonce}`,
    `account: ${params.accountAddress}`,
    `domain: ${params.domain}`
  ].join("\n");
}
