import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { apiProxies } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { updateProxySchema } from "@/lib/validations/proxy";

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

type Ctx = { params: Promise<{ id: string }> };

async function getOwnedProxy(userId: string, idOrSlug: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(apiProxies)
    .where(
      and(
        eq(apiProxies.ownerUserId, userId),
        isUuid(idOrSlug)
          ? eq(apiProxies.id, idOrSlug)
          : eq(apiProxies.slug, idOrSlug)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * GET /api/proxies/[id] — Get one proxy (owner only).
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const proxy = await getOwnedProxy(user.id, id);
  if (!proxy) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;
  return NextResponse.json({
    proxy,
    proxyUrl: `${base}/api/proxy/${proxy.id}`,
    proxyUrlBySlug: `${base}/api/proxy/${proxy.slug}`
  });
}

/**
 * PATCH /api/proxies/[id] — Update proxy (owner only).
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await getOwnedProxy(user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateProxySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ proxy: existing });
  }

  const db = getDb();
  try {
    const updated = await db
      .update(apiProxies)
      .set({
        ...patch,
        updatedAt: new Date()
      })
      .where(eq(apiProxies.id, existing.id))
      .returning();
    const row = updated[0];
    if (!row) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
    return NextResponse.json({ proxy: row });
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: string }).code)
        : "";
    if (msg === "23505") {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }
    console.error("[PATCH /api/proxies/[id]]", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

/**
 * DELETE /api/proxies/[id] — Delete proxy (owner only).
 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await getOwnedProxy(user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  await db.delete(apiProxies).where(eq(apiProxies.id, existing.id));
  return NextResponse.json({ success: true });
}
