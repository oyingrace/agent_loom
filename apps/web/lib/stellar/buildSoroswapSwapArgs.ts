import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import type { xdr } from "@stellar/stellar-sdk";

/**
 * Build Soroban `ScVal[]` for Soroswap router `swap_exact_tokens_for_tokens`.
 * See https://github.com/soroswap/core/blob/main/contracts/router/src/lib.rs
 */
export function buildSwapExactTokensForTokensArgs(params: {
  amountIn: bigint;
  amountOutMin: bigint;
  /** Token contract addresses (C...) in swap order, first = in, last = out */
  path: string[];
  /** Recipient of output tokens (typically the user's G... account) */
  to: string;
  /** Unix timestamp (seconds) before which the tx must execute */
  deadline: bigint;
}): xdr.ScVal[] {
  const { amountIn, amountOutMin, path, to, deadline } = params;
  if (path.length < 2) {
    throw new Error("path must include at least two token contract addresses");
  }

  const pathAddresses = path.map((p) => Address.fromString(p.trim()));

  return [
    nativeToScVal(amountIn, { type: "i128" }),
    nativeToScVal(amountOutMin, { type: "i128" }),
    nativeToScVal(pathAddresses, { type: { vec: { type: "address" } } }),
    nativeToScVal(Address.fromString(to.trim()), { type: "address" }),
    nativeToScVal(deadline, { type: "u64" })
  ];
}
