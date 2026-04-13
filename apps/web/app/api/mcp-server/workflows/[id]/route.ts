import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { mcpServerWorkflows, mcpServers } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/mcp-server/workflows/[id]
 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
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

  const linkRows = await db
    .select()
    .from(mcpServerWorkflows)
    .where(
      and(
        eq(mcpServerWorkflows.id, id),
        eq(mcpServerWorkflows.mcpServerId, server.id)
      )
    )
    .limit(1);

  if (!linkRows[0]) {
    return NextResponse.json({ error: "Workflow not found on this MCP server" }, { status: 404 });
  }

  await db.delete(mcpServerWorkflows).where(eq(mcpServerWorkflows.id, id));

  return NextResponse.json({ success: true });
}
