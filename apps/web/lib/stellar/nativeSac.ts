/**
 * Stellar Asset Contract (native XLM) per network.
 * Testnet value matches Soroswap quickstart / docs.
 * Mainnet: override with STELLAR_NATIVE_SAC_PUBLIC if the default changes.
 *
 * @see https://developers.stellar.org/docs/tokens/stellar-asset-contract
 */
export const STELLAR_NATIVE_SAC_DEFAULT = {
  testnet: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  /** Stellar public network native asset contract (verify in your env before mainnet use). */
  public: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUBC34FXO7AQMACC4CNJEY2A"
} as const;

export function getNativeSacContractId(network: "testnet" | "public"): string {
  const fromEnv =
    network === "public"
      ? process.env.STELLAR_NATIVE_SAC_PUBLIC?.trim()
      : process.env.STELLAR_NATIVE_SAC_TESTNET?.trim();
  if (fromEnv) return fromEnv;
  return network === "public"
    ? STELLAR_NATIVE_SAC_DEFAULT.public
    : STELLAR_NATIVE_SAC_DEFAULT.testnet;
}
