import { createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { oauthAccessTokens, sessionKeys, users } from "@agent-loom/database";

import { getDb } from "@/lib/db";

export type UserRow = InferSelectModel<typeof users>;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type BearerAuthContext = {
  user: UserRow;
  sessionKey: InferSelectModel<typeof sessionKeys> | null;
  scopes: string[];
  accessTokenId: string;
  mcpSlug: string | null;
  bearerToken: string;
};

/**
 * Validate OAuth access token (same rules as `apps/mcp-server` bearer check).
 */
export async function validateBearerToken(
  authHeader: string | null | undefined
): Promise<BearerAuthContext | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const db = getDb();

  const tokenRows = await db
    .select()
    .from(oauthAccessTokens)
    .where(
      and(
        eq(oauthAccessTokens.tokenHash, tokenHash),
        isNull(oauthAccessTokens.revokedAt),
        gt(oauthAccessTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  const accessToken = tokenRows[0];
  if (!accessToken) {
    return null;
  }

  let sessionKey: InferSelectModel<typeof sessionKeys> | null = null;
  if (accessToken.sessionKeyId) {
    const skRows = await db
      .select()
      .from(sessionKeys)
      .where(eq(sessionKeys.id, accessToken.sessionKeyId))
      .limit(1);
    const sk = skRows[0];
    if (!sk || sk.revokedAt) {
      return null;
    }
    const now = new Date();
    if (now < sk.validFrom || now > sk.validUntil) {
      return null;
    }
    sessionKey = sk;
  }

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, accessToken.userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    return null;
  }

  const scopes = (accessToken.scope ?? "")
    .split(/\s+/)
    .filter(Boolean);

  return {
    user,
    sessionKey,
    scopes,
    accessTokenId: accessToken.id,
    mcpSlug: accessToken.mcpSlug ?? null,
    bearerToken: token
  };
}
