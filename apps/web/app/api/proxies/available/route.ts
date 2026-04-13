import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { apiProxies } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/auth/withAuth";

/**
 * GET /api/proxies/available — Public proxies plus the current user's (for MCP tools).
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const visibility = or(
    eq(apiProxies.isPublic, true),
    eq(apiProxies.ownerUserId, user.id)
  );

  const conditions = [visibility];

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(apiProxies.name, term),
        ilike(sql`coalesce(${apiProxies.description}, '')`, term)
      )!
    );
  }

  if (category?.trim()) {
    conditions.push(eq(apiProxies.category, category.trim()));
  }

  const db = getDb();
  const rows = await db
    .select({
      id: apiProxies.id,
      slug: apiProxies.slug,
      name: apiProxies.name,
      description: apiProxies.description,
      pricingAsset: apiProxies.pricingAsset,
      pricingAmount: apiProxies.pricingAmount,
      category: apiProxies.category,
      tags: apiProxies.tags,
      isPublic: apiProxies.isPublic,
      ownerUserId: apiProxies.ownerUserId,
      createdAt: apiProxies.createdAt
    })
    .from(apiProxies)
    .where(and(...conditions))
    .orderBy(desc(apiProxies.createdAt))
    .limit(limit);

  const catRows = await db
    .selectDistinct({ category: apiProxies.category })
    .from(apiProxies)
    .where(visibility);

  const categories = catRows
    .map((r) => r.category)
    .filter((c): c is string => c != null && c.length > 0)
    .sort();

  return NextResponse.json({
    proxies: rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      pricingAsset: p.pricingAsset,
      pricingAmount: p.pricingAmount,
      category: p.category,
      tags: p.tags,
      isPublic: p.isPublic,
      isOwn: p.ownerUserId === user.id,
      createdAt: p.createdAt.toISOString()
    })),
    categories
  });
});
