import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import {
  getOAuthClient,
  getAndValidateAuthCode,
  markAuthCodeConsumed,
  verifyCodeChallenge,
  generateAccessToken,
  hashToken,
  getUserById
} from "@/lib/auth/oauth";
import { oauthAccessTokens, sessionKeys } from "@agent-loom/database";
import { getDb } from "@/lib/db";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, mcp-protocol-version"
  };
}

/**
 * POST /api/oauth/token
 * Authorization code + PKCE exchange for bearer access token.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries()) as Record<string, string>;
  } else {
    body = await request.json();
  }

  const {
    grant_type: grantType,
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier
  } = body;

  if (grantType !== "authorization_code") {
    return NextResponse.json(
      {
        error: "unsupported_grant_type",
        error_description: "Only authorization_code is supported"
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (!code || !clientId || !clientSecret || !codeVerifier) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "Missing required parameters"
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  const client = await getOAuthClient(clientId);
  if (!client || !client.clientSecretHash) {
    return NextResponse.json(
      { error: "invalid_client", error_description: "Unknown client" },
      { status: 401, headers: corsHeaders() }
    );
  }

  const secretOk = await bcrypt.compare(clientSecret, client.clientSecretHash);
  if (!secretOk) {
    return NextResponse.json(
      {
        error: "invalid_client",
        error_description: "Invalid client credentials"
      },
      { status: 401, headers: corsHeaders() }
    );
  }

  const authCode = await getAndValidateAuthCode(code, clientId);
  if (!authCode) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code"
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (redirectUri && authCode.redirectUri && authCode.redirectUri !== redirectUri) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Redirect URI mismatch"
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (!authCode.codeChallenge) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Authorization code missing PKCE challenge"
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (!verifyCodeChallenge(codeVerifier, authCode.codeChallenge)) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Invalid code_verifier"
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  await markAuthCodeConsumed(code);

  const accessToken = generateAccessToken();
  const tokenHash = hashToken(accessToken);
  const now = new Date();
  const db = getDb();

  let expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
  if (authCode.sessionKeyId) {
    const rows = await db
      .select()
      .from(sessionKeys)
      .where(eq(sessionKeys.id, authCode.sessionKeyId))
      .limit(1);
    const sk = rows[0];
    if (sk && sk.validUntil > now) {
      expiresAt = sk.validUntil;
    }
  }

  await db.insert(oauthAccessTokens).values({
    clientId,
    userId: authCode.userId,
    sessionKeyId: authCode.sessionKeyId,
    tokenHash,
    scope: authCode.scope,
    mcpSlug: client.mcpSlug ?? null,
    expiresAt
  });

  const user = await getUserById(authCode.userId);

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
      scope: authCode.scope ?? "",
      account_address: user?.accountAddress ?? null
    },
    { headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
