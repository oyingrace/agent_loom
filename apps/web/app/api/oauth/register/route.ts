import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { oauthClients } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

const DEFAULT_SCOPES = [
  "mcp:tools",
  "stellar:payments",
  "stellar:soroswap"
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

/**
 * POST /api/oauth/register
 * Dynamic client registration (RFC 7591-style). Requires an authenticated web session.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", error_description: "Sign in required" },
        { status: 401, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const { searchParams } = new URL(request.url);

    let mcpSlug: string | null = searchParams.get("mcp_slug");
    if (!mcpSlug) {
      const referer =
        request.headers.get("referer") ?? request.headers.get("origin");
      if (referer) {
        const match = referer.match(/\/mcp\/([^/]+)/);
        const slug = match?.[1];
        if (slug) mcpSlug = slug;
      }
    }

    const {
      redirect_uris: redirectUris,
      client_name: clientName,
      client_uri: clientUri,
      scope
    } = body;

    if (
      !redirectUris ||
      !Array.isArray(redirectUris) ||
      redirectUris.length === 0
    ) {
      return NextResponse.json(
        {
          error: "invalid_redirect_uri",
          error_description:
            "redirect_uris is required and must be a non-empty array"
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    for (const uri of redirectUris as string[]) {
      try {
        new URL(uri);
      } catch {
        return NextResponse.json(
          {
            error: "invalid_redirect_uri",
            error_description: `Invalid redirect URI: ${uri}`
          },
          { status: 400, headers: corsHeaders() }
        );
      }
    }

    const requestedScopes = scope
      ? String(scope).split(/\s+/).filter(Boolean)
      : DEFAULT_SCOPES;

    const normalizedUris = [...redirectUris].map((u: string) => u.toLowerCase()).sort();
    const db = getDb();

    const allRows = await db.select().from(oauthClients);
    const existing = allRows.find((client) => {
      if (!client.redirectUris?.length) return false;
      const clientSorted = [...client.redirectUris]
        .map((u) => u.toLowerCase())
        .sort();
      return (
        client.ownerUserId === user.id &&
        JSON.stringify(clientSorted) === JSON.stringify(normalizedUris)
      );
    });

    const clientSecret = randomBytes(32).toString("base64url");
    const secretHash = await bcrypt.hash(clientSecret, 10);

    let clientId: string;

    if (existing) {
      clientId = existing.clientId;
      await db
        .update(oauthClients)
        .set({
          clientSecretHash: secretHash,
          allowedScopes: requestedScopes,
          mcpSlug: mcpSlug ?? existing.mcpSlug ?? null,
          updatedAt: new Date()
        })
        .where(eq(oauthClients.id, existing.id));
    } else {
      clientId = `mcp_${randomBytes(16).toString("hex")}`;
      await db.insert(oauthClients).values({
        ownerUserId: user.id,
        clientId,
        clientSecretHash: secretHash,
        allowedScopes: requestedScopes,
        redirectUris: redirectUris as string[],
        grantTypes: ["authorization_code"],
        mcpSlug: mcpSlug ?? null
      });
    }

    return NextResponse.json(
      {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0,
        redirect_uris: redirectUris,
        client_name: clientName ?? "MCP Client",
        client_uri: clientUri,
        scope: requestedScopes.join(" "),
        token_endpoint_auth_method: "client_secret_post",
        grant_types: ["authorization_code"],
        response_types: ["code"]
      },
      {
        status: existing ? 200 : 201,
        headers: corsHeaders()
      }
    );
  } catch (error) {
    console.error("[POST /api/oauth/register]", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to register client" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
