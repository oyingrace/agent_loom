import { NonceRepository } from "./nonce";
import { ProxyPaymentNonceRepository } from "./proxyPaymentNonce";

/** Wallet auth nonces (single-use, short TTL). */
export const authNonceRepository = new NonceRepository("agent_loom:auth:nonce:", 5 * 60);

/** Proxy payment memo nonces (Horizon + memo binding). */
export const proxyPaymentNonceRepository = new ProxyPaymentNonceRepository(
  "agent_loom:proxy:pay:",
  60 * 60
);

export { NonceRepository } from "./nonce";
export { ProxyPaymentNonceRepository } from "./proxyPaymentNonce";
