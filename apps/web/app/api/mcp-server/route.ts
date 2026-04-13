import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { apiProxies, mcpServerTools, mcpServers } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/auth/withAuth";

/**
 * GET /api/mcp-server — Current user's MCP server and tools.
 */
export const GET = withAuth(async (user, _request: NextRequest) => {
  const db = getDb();
  const serverRows = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.ownerUserId, user.id))
    .limit(1);

  const server = serverRows[0];
  if (!server) {
    return NextResponse.json({ server: null, tools: [] });
  }

  const tools = await db
    .select({
      id: mcpServerTools.id,
      toolName: mcpServerTools.toolName,
      shortDescription: mcpServerTools.description,
      isEnabled: mcpServerTools.enabled,
      displayOrder: mcpServerTools.sortOrder,
      proxyId: apiProxies.id,
      proxyName: apiProxies.name,
      proxyDescription: apiProxies.description,
      pricingAsset: apiProxies.pricingAsset,
      pricingAmount: apiProxies.pricingAmount,
      category: apiProxies.category
    })
    .from(mcpServerTools)
    .innerJoin(apiProxies, eq(mcpServerTools.proxyId, apiProxies.id))
    .where(eq(mcpServerTools.mcpServerId, server.id))
    .orderBy(asc(mcpServerTools.sortOrder));

  return NextResponse.json({
    server: {
      ...server,
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString()
    },
    tools: tools.map((t) => ({
      id: t.id,
      toolName: t.toolName,
      shortDescription: t.shortDescription,
      isEnabled: t.isEnabled,
      displayOrder: t.displayOrder,
      apiProxy: {
        id: t.proxyId,
        name: t.proxyName,
        description: t.proxyDescription,
        pricingAsset: t.pricingAsset,
        pricingAmount: t.pricingAmount,
        category: t.category
      }
    }))
  });
});

/**
 * POST /api/mcp-server — Create MCP server (one per user).
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  const body = (await request.json()) as {
    slug?: string;
    name?: string;
    description?: string | null;
    isPublic?: boolean;
  };

  if (!body.slug || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase letters, numbers, and hyphens only" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db
    .select({ id: mcpServers.id })
    .from(mcpServers)
    .where(eq(mcpServers.ownerUserId, user.id))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json(
      { error: "You already have an MCP server" },
      { status: 400 }
    );
  }

  const slugTaken = await db
    .select({ id: mcpServers.id })
    .from(mcpServers)
    .where(eq(mcpServers.slug, body.slug))
    .limit(1);

  if (slugTaken[0]) {
    return NextResponse.json({ error: "This slug is already taken" }, { status: 400 });
  }

  const inserted = await db
    .insert(mcpServers)
    .values({
      ownerUserId: user.id,
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      isPublic: body.isPublic ?? false
    })
    .returning();

  const server = inserted[0];
  if (!server) {
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }

  return NextResponse.json({
    server: {
      ...server,
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString()
    }
  });
});

/**
 * PUT /api/mcp-server — Update current user's MCP server.
 */
export const PUT = withAuth(async (user, request: NextRequest) => {
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    isPublic?: boolean;
  };

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.ownerUserId, user.id))
    .limit(1);

  const existing = rows[0];
  if (!existing) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  const updated = await db
    .update(mcpServers)
    .set({
      name: body.name,
      description: body.description ?? null,
      isPublic: body.isPublic ?? false,
      updatedAt: new Date()
    })
    .where(eq(mcpServers.id, existing.id))
    .returning();

  const server = updated[0];
  if (!server) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({
    server: {
      ...server,
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString()
    }
  });
});
