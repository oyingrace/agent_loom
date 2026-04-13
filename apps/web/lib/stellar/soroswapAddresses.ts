/**
 * Soroswap AMM router addresses (UniswapV2-style `swap_exact_tokens_for_tokens` on router).
 * Source of truth: https://github.com/soroswap/core/blob/main/public/testnet.contracts.json
 * and https://github.com/soroswap/core/blob/main/public/mainnet.contracts.json
 * Docs: https://docs.soroswap.finance/smart-contracts/01-protocol-overview/03-technical-reference/deployed-addresses
 */
export const SOROSWAP_ROUTER_DEFAULT = {
  testnet: "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD",
  public: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH"
} as const;

export function getSoroswapRouterContractId(network: "testnet" | "public"): string {
  const fromEnv =
    network === "public"
      ? process.env.SOROSWAP_ROUTER_MAINNET?.trim()
      : process.env.SOROSWAP_ROUTER_TESTNET?.trim();
  if (fromEnv) return fromEnv;
  return SOROSWAP_ROUTER_DEFAULT[network === "public" ? "public" : "testnet"];
}
