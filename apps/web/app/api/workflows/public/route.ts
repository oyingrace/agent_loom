import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { users, workflowTemplates } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { z } from "zod";

const querySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(["newest", "oldest", "steps"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

/**
 * GET /api/workflows/public — List public workflow templates.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { search, sortBy, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [eq(workflowTemplates.isPublic, true)];

    if (search) {
      conditions.push(
        or(
          ilike(workflowTemplates.name, `%${search}%`),
          ilike(workflowTemplates.description, `%${search}%`)
        )!
      );
    }

    const db = getDb();
    const whereClause = and(...conditions);

    let orderBy;
    switch (sortBy) {
      case "oldest":
        orderBy = asc(workflowTemplates.createdAt);
        break;
      case "steps":
        orderBy = desc(
          sql`COALESCE(jsonb_array_length(${workflowTemplates.workflowDefinition}->'steps'), 0)`
        );
        break;
      case "newest":
      default:
        orderBy = desc(workflowTemplates.createdAt);
    }

    const list = await db
      .select({
        id: workflowTemplates.id,
        name: workflowTemplates.name,
        description: workflowTemplates.description,
        workflowDefinition: workflowTemplates.workflowDefinition,
        isPublic: workflowTemplates.isPublic,
        createdAt: workflowTemplates.createdAt,
        updatedAt: workflowTemplates.updatedAt,
        ownerAccount: users.accountAddress
      })
      .from(workflowTemplates)
      .innerJoin(users, eq(workflowTemplates.ownerUserId, users.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workflowTemplates)
      .where(whereClause);

    const total = countRows[0]?.count ?? 0;

    return NextResponse.json({
      workflows: list.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (e) {
    console.error("[GET /api/workflows/public]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
