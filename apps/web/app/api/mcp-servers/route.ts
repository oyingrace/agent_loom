import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  mcpServerTools,
  mcpServerWorkflows,
  mcpServers,
  users
} from "@agent-loom/database";
import { getDb } from "@/lib/db";

const querySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(["newest", "oldest", "tools", "workflows"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

/**
 * GET /api/mcp-servers — List public MCP servers (discovery, no auth).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { search, sortBy, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [eq(mcpServers.isPublic, true)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(mcpServers.name, pattern),
          ilike(sql`coalesce(${mcpServers.description}, '')`, pattern)
        )!
      );
    }

    const db = getDb();

    const toolCountSubquery = db
      .select({
        mcpServerId: mcpServerTools.mcpServerId,
        count: sql<number>`count(*)::int`.as("tool_count")
      })
      .from(mcpServerTools)
      .where(eq(mcpServerTools.enabled, true))
      .groupBy(mcpServerTools.mcpServerId)
      .as("tool_counts");

    const workflowCountSubquery = db
      .select({
        mcpServerId: mcpServerWorkflows.mcpServerId,
        count: sql<number>`count(*)::int`.as("workflow_count")
      })
      .from(mcpServerWorkflows)
      .where(eq(mcpServerWorkflows.enabled, true))
      .groupBy(mcpServerWorkflows.mcpServerId)
      .as("workflow_counts");

    const baseQuery = db
      .select({
        id: mcpServers.id,
        slug: mcpServers.slug,
        name: mcpServers.name,
        description: mcpServers.description,
        isPublic: mcpServers.isPublic,
        createdAt: mcpServers.createdAt,
        updatedAt: mcpServers.updatedAt,
        ownerAccount: users.accountAddress,
        toolCount: sql<number>`COALESCE(${toolCountSubquery.count}, 0)`,
        workflowCount: sql<number>`COALESCE(${workflowCountSubquery.count}, 0)`
      })
      .from(mcpServers)
      .innerJoin(users, eq(mcpServers.ownerUserId, users.id))
      .leftJoin(toolCountSubquery, eq(mcpServers.id, toolCountSubquery.mcpServerId))
      .leftJoin(
        workflowCountSubquery,
        eq(mcpServers.id, workflowCountSubquery.mcpServerId)
      )
      .where(and(...conditions));

    let orderBy;
    switch (sortBy) {
      case "oldest":
        orderBy = asc(mcpServers.createdAt);
        break;
      case "tools":
        orderBy = desc(sql`COALESCE(${toolCountSubquery.count}, 0)`);
        break;
      case "workflows":
        orderBy = desc(sql`COALESCE(${workflowCountSubquery.count}, 0)`);
        break;
      case "newest":
      default:
        orderBy = desc(mcpServers.createdAt);
    }

    const servers = await baseQuery.orderBy(orderBy).limit(limit).offset(offset);

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcpServers)
      .where(and(...conditions));
    const total = countRows[0]?.count ?? 0;

    const result = servers.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      isPublic: s.isPublic,
      ownerAccount: s.ownerAccount,
      toolCount: Number(s.toolCount),
      workflowCount: Number(s.workflowCount),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString()
    }));

    return NextResponse.json({
      servers: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (e) {
    console.error("[GET /api/mcp-servers]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
