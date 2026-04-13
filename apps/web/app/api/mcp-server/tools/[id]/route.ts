import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { mcpServerTools, mcpServers } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/mcp-server/tools/[id]
 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: toolId } = await ctx.params;

  if (!toolId) {
    return NextResponse.json({ error: "Tool ID is required" }, { status: 400 });
  }

  const db = getDb();
  const serverRows = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.ownerUserId, user.id))
    .limit(1);

  const server = serverRows[0];
  if (!server) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  const toolRows = await db
    .select()
    .from(mcpServerTools)
    .where(
      and(eq(mcpServerTools.id, toolId), eq(mcpServerTools.mcpServerId, server.id))
    )
    .limit(1);

  if (!toolRows[0]) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  await db.delete(mcpServerTools).where(eq(mcpServerTools.id, toolId));

  return NextResponse.json({ success: true });
}
