import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  getOAuthClient,
  generateAuthCode,
  validateRedirectUri,
  validateScopes,
  getSessionKeyForUser
} from "@/lib/auth/oauth";
import { scopeDetailsForIds } from "@/lib/oauth/scopeMeta";
import { withAuth } from "@/lib/auth/withAuth";
import { mcpServers, oauthAuthCodes } from "@agent-loom/database";
import { getDb } from "@/lib/db";

/**
 * GET /api/oauth/authorize
 * Returns metadata for a consent UI (JSON). Validates OAuth query parameters.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const responseType = searchParams.get("response_type");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");
  const scopeParam = searchParams.get("scope");
  const state = searchParams.get("state");
  const mcpSlug = searchParams.get("mcp_slug");

  if (!clientId) {
    return NextResponse.json({ error: "missing_client_id" }, { status: 400 });
  }
  if (!redirectUri) {
    return NextResponse.json({ error: "missing_redirect_uri" }, { status: 400 });
  }
  if (responseType !== "code") {
    return NextResponse.json(
      { error: "unsupported_response_type" },
      { status: 400 }
    );
  }
  if (!codeChallenge) {
    return NextResponse.json({ error: "missing_code_challenge" }, { status: 400 });
  }
  if (codeChallengeMethod !== "S256") {
    return NextResponse.json(
      { error: "unsupported_code_challenge_method" },
      { status: 400 }
    );
  }
  if (!scopeParam) {
    return NextResponse.json({ error: "missing_scope" }, { status: 400 });
  }

  const client = await getOAuthClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  const effectiveSlug = mcpSlug ?? client.mcpSlug ?? undefined;

  if (!validateRedirectUri(client, redirectUri)) {
    return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }

  const requestedScopes = scopeParam.split(/\s+/).filter(Boolean);
  const scopeValidation = validateScopes(client, requestedScopes);
  if (!scopeValidation.valid) {
    return NextResponse.json(
      {
        error: "invalid_scope",
        invalid_scopes: scopeValidation.invalidScopes
      },
      { status: 400 }
    );
  }

  const scopeDetails = scopeDetailsForIds(requestedScopes);

  let clientName = client.clientId;
  let clientDescription: string | null = null;
  if (effectiveSlug) {
    const db = getDb();
    const mcpRows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.slug, effectiveSlug))
      .limit(1);
    const mcp = mcpRows[0];
    if (mcp) {
      clientName = mcp.name;
      clientDescription = mcp.description ?? null;
    }
  }

  return NextResponse.json({
    client: {
      id: client.clientId,
      name: clientName,
      description: clientDescription,
      logoUrl: null as string | null
    },
    scopes: scopeDetails,
    redirectUri,
    state,
    mcpSlug: effectiveSlug ?? null
  });
}

/**
 * POST /api/oauth/authorize
 * After the user approves (and is signed in), creates an authorization code (PKCE).
 *
 * Body:
 * - client_id, redirect_uri, code_challenge, approved_scopes[], state?, mcp_slug?, session_key_id?
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  const body = await request.json();

  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    approved_scopes: approvedScopes,
    state,
    mcp_slug: mcpSlug,
    session_key_id: sessionKeyId
  } = body as Record<string, unknown>;

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "missing_client_id" }, { status: 400 });
  }
  if (!redirectUri || typeof redirectUri !== "string") {
    return NextResponse.json({ error: "missing_redirect_uri" }, { status: 400 });
  }
  if (!codeChallenge || typeof codeChallenge !== "string") {
    return NextResponse.json({ error: "missing_code_challenge" }, { status: 400 });
  }
  if (!Array.isArray(approvedScopes) || approvedScopes.length === 0) {
    return NextResponse.json({ error: "no_scopes_approved" }, { status: 400 });
  }

  const client = await getOAuthClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  if (!validateRedirectUri(client, redirectUri)) {
    return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }

  const approved = approvedScopes.filter((s): s is string => typeof s === "string");
  const scopeValidation = validateScopes(client, approved);
  if (!scopeValidation.valid) {
    return NextResponse.json(
      {
        error: "invalid_scope",
        invalid_scopes: scopeValidation.invalidScopes
      },
      { status: 400 }
    );
  }

  let resolvedSessionKeyId: string | null = null;
  if (sessionKeyId != null && sessionKeyId !== "") {
    if (typeof sessionKeyId !== "string") {
      return NextResponse.json({ error: "invalid_session_key_id" }, { status: 400 });
    }
    const sk = await getSessionKeyForUser(sessionKeyId, user.id);
    if (!sk || sk.revokedAt) {
      return NextResponse.json({ error: "session_key_not_found" }, { status: 404 });
    }
    resolvedSessionKeyId = sk.id;
  }

  const code = generateAuthCode();
  const now = new Date();
  const db = getDb();

  await db.insert(oauthAuthCodes).values({
    clientId: client.clientId,
    userId: user.id,
    sessionKeyId: resolvedSessionKeyId,
    code,
    codeChallenge,
    codeChallengeMethod: "S256",
    scope: approved.join(" "),
    redirectUri,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000)
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (typeof state === "string" && state.length > 0) {
    redirectUrl.searchParams.set("state", state);
  }
  if (typeof mcpSlug === "string" && mcpSlug.length > 0) {
    redirectUrl.searchParams.set("mcp_slug", mcpSlug);
  }

  return NextResponse.json({
    redirect_uri: redirectUrl.toString()
  });
});
