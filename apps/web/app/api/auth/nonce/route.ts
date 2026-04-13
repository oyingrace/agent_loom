import { NextResponse } from "next/server";
import { generateNonce } from "@/lib/auth/nonce";
import { AUTH_MESSAGE_VERSION } from "@/lib/stellar/authMessage";
import { getAuthDomain } from "@/lib/stellar/authDomain";

/**
 * GET /api/auth/nonce
 * Single-use nonce for wallet auth (consume on session creation).
 * Clients must sign `buildAuthMessage({ nonce, accountAddress, domain })` (see Phase 4 docs).
 */
export async function GET(): Promise<NextResponse> {
  const nonce = await generateNonce();
  const domain = getAuthDomain();

  return NextResponse.json(
    {
      nonce,
      messageVersion: AUTH_MESSAGE_VERSION,
      domain
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      }
    }
  );
}
