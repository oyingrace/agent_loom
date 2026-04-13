import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { users } from "@agent-loom/database";
import { getDb } from "@/lib/db";

export interface SessionData {
  accountAddress?: string;
  userId?: string;
  isLoggedIn: boolean;
}

function getSessionPassword(): string {
  const password =
    process.env.APP_SESSION_SECRET ?? process.env.SESSION_SECRET ?? "";
  if (password.length < 32) {
    throw new Error(
      "APP_SESSION_SECRET (or SESSION_SECRET) must be at least 32 characters"
    );
  }
  return password;
}

function getResolvedSessionOptions(): SessionOptions {
  return {
    password: getSessionPassword(),
    cookieName: "agent_loom_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7
    }
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getResolvedSessionOptions());
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return null;
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function createSession(accountAddress: string) {
  const normalized = accountAddress.trim();
  const db = getDb();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.accountAddress, normalized))
    .limit(1);

  let user = existing[0];
  if (!user) {
    const inserted = await db
      .insert(users)
      .values({ accountAddress: normalized })
      .returning();
    user = inserted[0];
  }

  if (!user) {
    throw new Error("Failed to resolve user");
  }

  const session = await getSession();
  session.accountAddress = normalized;
  session.userId = user.id;
  session.isLoggedIn = true;
  await session.save();

  return user;
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}
