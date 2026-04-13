import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { oauthAuthCodes, oauthClients, sessionKeys, users } from "@agent-loom/database";
import { getDb } from "@/lib/db";

export type User = typeof users.$inferSelect;

export function generateSecureToken(length = 32): string {
  return randomBytes(length).toString("base64url");
}

export function generateAuthCode(): string {
  return generateSecureToken(48);
}

export function generateAccessToken(): string {
  return generateSecureToken(64);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string
): boolean {
  const hash = createHash("sha256").update(codeVerifier).digest("base64url");
  return hash === codeChallenge;
}

export async function getOAuthClient(clientId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

export function validateRedirectUri(
  client: { redirectUris: string[] },
  redirectUri: string
): boolean {
  return client.redirectUris.includes(redirectUri);
}

export function validateScopes(
  client: { allowedScopes: string[] },
  requestedScopes: string[]
): { valid: boolean; invalidScopes: string[] } {
  const invalidScopes = requestedScopes.filter(
    (s) => !client.allowedScopes.includes(s)
  );
  return { valid: invalidScopes.length === 0, invalidScopes };
}

export async function getAndValidateAuthCode(code: string, clientId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(oauthAuthCodes)
    .where(
      and(
        eq(oauthAuthCodes.code, code),
        eq(oauthAuthCodes.clientId, clientId),
        isNull(oauthAuthCodes.consumedAt),
        gt(oauthAuthCodes.expiresAt, new Date())
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function markAuthCodeConsumed(code: string) {
  const db = getDb();
  await db
    .update(oauthAuthCodes)
    .set({ consumedAt: new Date() })
    .where(eq(oauthAuthCodes.code, code));
}

export async function getUserById(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSessionKeyForUser(
  sessionKeyId: string,
  userId: string
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(sessionKeys)
    .where(
      and(eq(sessionKeys.id, sessionKeyId), eq(sessionKeys.userId, userId))
    )
    .limit(1);
  return rows[0] ?? null;
}
