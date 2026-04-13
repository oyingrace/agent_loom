import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSession,
  destroySession,
  getCurrentUser
} from "@/lib/auth/session";
import { verifyNonce } from "@/lib/auth/nonce";
import { buildAuthMessage } from "@/lib/stellar/authMessage";
import { getAuthDomain } from "@/lib/stellar/authDomain";
import {
  isEd25519PublicKeyStrkey,
  verifyAuthMessageSignature
} from "@/lib/stellar/verifySignature";

const createSessionSchema = z.object({
  accountAddress: z
    .string()
    .min(1, "accountAddress is required")
    .refine(
      isEd25519PublicKeyStrkey,
      "Session login requires a Stellar account public key strkey (G…). Contract addresses (C…) are not supported for this flow yet."
    ),
  nonce: z.string().min(1, "Nonce is required"),
  signature: z.string().min(1, "signature is required")
});

/**
 * POST /api/auth/session — Create session after nonce + SEP-0053 message signature verification
 * (SHA-256 of the SEP-0053 prefix plus UTF-8 message, then Ed25519).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createSessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { accountAddress, nonce, signature } = result.data;

    const domain = getAuthDomain();
    const message = buildAuthMessage({
      nonce,
      accountAddress: accountAddress.trim(),
      domain
    });

    const signatureOk = verifyAuthMessageSignature({
      accountAddress,
      messageUtf8: message,
      signature
    });

    if (!signatureOk) {
      return NextResponse.json(
        { error: "Invalid signature", code: "invalid_signature" },
        { status: 401 }
      );
    }

    const ok = await verifyNonce(nonce);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid or expired nonce" },
        { status: 401 }
      );
    }

    const user = await createSession(accountAddress);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        accountAddress: user.accountAddress
      }
    });
  } catch (error) {
    console.error("[POST /api/auth/session]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/session — Current session.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        accountAddress: user.accountAddress
      }
    });
  } catch (error) {
    console.error("[GET /api/auth/session]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session — Logout.
 */
export async function DELETE() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/auth/session]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
