import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { apiProxies } from "@agent-loom/database";
import { getDb } from "@/lib/db";

const marketplaceQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  sortBy: z.enum(["newest", "oldest", "price_low", "price_high"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

/**
 * GET /api/marketplace — List public, active API proxies (marketplace / explore).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = marketplaceQuerySchema.safeParse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      tags: searchParams.get("tags") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { search, category, tags, sortBy, page, limit } = queryResult.data;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(apiProxies.isPublic, true),
      eq(apiProxies.isActive, true)
    ];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(apiProxies.name, pattern),
          ilike(sql`coalesce(${apiProxies.description}, '')`, pattern)
        )!
      );
    }

    if (category) {
      conditions.push(eq(apiProxies.category, category));
    }

    if (tags) {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagList.length > 0) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${apiProxies.tags}) AS elem(tag)
            WHERE elem.tag IN (${sql.join(
              tagList.map((t) => sql`${t}`),
              sql`, `
            )})
          )`
        );
      }
    }

    let orderBy;
    switch (sortBy) {
      case "oldest":
        orderBy = asc(apiProxies.createdAt);
        break;
      case "price_low":
        orderBy = asc(
          sql`COALESCE(
            CASE
              WHEN TRIM(${apiProxies.pricingAmount}) ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN TRIM(${apiProxies.pricingAmount})::numeric
            END,
            0
          )`
        );
        break;
      case "price_high":
        orderBy = desc(
          sql`COALESCE(
            CASE
              WHEN TRIM(${apiProxies.pricingAmount}) ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN TRIM(${apiProxies.pricingAmount})::numeric
            END,
            0
          )`
        );
        break;
      case "newest":
      default:
        orderBy = desc(apiProxies.createdAt);
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
        httpMethod: apiProxies.httpMethod,
        createdAt: apiProxies.createdAt
      })
      .from(apiProxies)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const countRow = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiProxies)
      .where(and(...conditions));
    const count = countRow[0]?.count ?? 0;

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;

    const result = rows.map((proxy) => ({
      id: proxy.id,
      slug: proxy.slug,
      name: proxy.name,
      description: proxy.description,
      proxyUrl: `${baseUrl}/api/proxy/${proxy.slug || proxy.id}`,
      pricingAsset: proxy.pricingAsset,
      pricingAmount: proxy.pricingAmount,
      category: proxy.category,
      tags: proxy.tags ?? [],
      httpMethod: proxy.httpMethod,
      createdAt: proxy.createdAt.toISOString()
    }));

    return NextResponse.json({
      proxies: result,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error("[GET /api/marketplace]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
