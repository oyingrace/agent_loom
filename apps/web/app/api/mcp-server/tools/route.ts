import { NextResponse } from "next/server";
import { and, eq, max, or } from "drizzle-orm";
import { apiProxies, mcpServerTools, mcpServers } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/auth/withAuth";

/**
 * POST /api/mcp-server/tools — Attach a proxy as a tool.
 */
export const POST = withAuth(async (user, request) => {
  const body = (await request.json()) as { proxyId?: string };
  const { proxyId } = body;

  if (!proxyId || typeof proxyId !== "string") {
    return NextResponse.json({ error: "proxyId is required" }, { status: 400 });
  }

  const db = getDb();
  const serverRows = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.ownerUserId, user.id))
    .limit(1);

  const server = serverRows[0];
  if (!server) {
    return NextResponse.json(
      { error: "MCP server not found. Create one first." },
      { status: 404 }
    );
  }

  const proxyRows = await db
    .select()
    .from(apiProxies)
    .where(
      and(
        eq(apiProxies.id, proxyId),
        or(eq(apiProxies.isPublic, true), eq(apiProxies.ownerUserId, user.id))
      )
    )
    .limit(1);

  const proxy = proxyRows[0];
  if (!proxy) {
    return NextResponse.json(
      { error: "API proxy not found or not accessible" },
      { status: 404 }
    );
  }

  const dup = await db
    .select({ id: mcpServerTools.id })
    .from(mcpServerTools)
    .where(
      and(
        eq(mcpServerTools.mcpServerId, server.id),
        eq(mcpServerTools.proxyId, proxyId)
      )
    )
    .limit(1);

  if (dup[0]) {
    return NextResponse.json({ error: "This tool is already added" }, { status: 400 });
  }

  const maxOrder = await db
    .select({ maxOrder: max(mcpServerTools.sortOrder) })
    .from(mcpServerTools)
    .where(eq(mcpServerTools.mcpServerId, server.id));

  const nextOrder = (maxOrder[0]?.maxOrder ?? -1) + 1;

  const inserted = await db
    .insert(mcpServerTools)
    .values({
      mcpServerId: server.id,
      proxyId: proxy.id,
      toolName: proxy.name.slice(0, 120),
      description: proxy.description ?? null,
      enabled: true,
      sortOrder: nextOrder
    })
    .returning();

  const tool = inserted[0];
  if (!tool) {
    return NextResponse.json({ error: "Failed to add tool" }, { status: 500 });
  }

  return NextResponse.json(
    {
      tool: {
        id: tool.id,
        toolName: tool.toolName,
        shortDescription: tool.description,
        isEnabled: tool.enabled,
        displayOrder: tool.sortOrder,
        apiProxy: {
          id: proxy.id,
          name: proxy.name,
          description: proxy.description,
          pricingAsset: proxy.pricingAsset,
          pricingAmount: proxy.pricingAmount,
          category: proxy.category
        }
      }
    },
    { status: 201 }
  );
});
