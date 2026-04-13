import { NextResponse } from "next/server";
import { and, eq, max, or } from "drizzle-orm";
import {
  mcpServerWorkflows,
  mcpServers,
  workflowTemplates
} from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/auth/withAuth";

type WfRow = {
  id: string;
  name: string;
  description: string | null;
  workflowDefinition: Record<string, unknown>;
};

function workflowTemplateSummary(w: WfRow) {
  const def = w.workflowDefinition as { steps?: unknown[] };
  const steps = Array.isArray(def?.steps) ? def.steps : [];
  return {
    id: w.id,
    name: w.name,
    slug: w.id,
    description: w.description,
    inputSchema: [] as { name: string; type: string }[],
    workflowDefinition: {
      steps: steps.map((s) => ({
        type:
          typeof s === "object" && s && "type" in s
            ? String((s as { type?: string }).type)
            : "unknown"
      }))
    }
  };
}

/**
 * GET /api/mcp-server/workflows
 */
export const GET = withAuth(async (user) => {
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

  const links = await db
    .select()
    .from(mcpServerWorkflows)
    .where(eq(mcpServerWorkflows.mcpServerId, server.id));

  const workflows = await Promise.all(
    links.map(async (sw) => {
      const wtRows = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.id, sw.workflowTemplateId))
        .limit(1);
      const wt = wtRows[0];
      return {
        id: sw.id,
        toolName: sw.toolName,
        toolDescription: sw.description,
        isEnabled: sw.enabled,
        displayOrder: sw.sortOrder,
        workflow: wt ? workflowTemplateSummary(wt) : null
      };
    })
  );

  return NextResponse.json({ workflows });
});

/**
 * POST /api/mcp-server/workflows
 */
export const POST = withAuth(async (user, request) => {
  const body = (await request.json()) as {
    workflowId?: string;
    toolName?: string | null;
    toolDescription?: string | null;
  };

  if (!body.workflowId || typeof body.workflowId !== "string") {
    return NextResponse.json({ error: "workflowId is required" }, { status: 400 });
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

  const wfRows = await db
    .select()
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.id, body.workflowId),
        or(
          eq(workflowTemplates.isPublic, true),
          eq(workflowTemplates.ownerUserId, user.id)
        )
      )
    )
    .limit(1);

  const workflow = wfRows[0];
  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found or not accessible" },
      { status: 404 }
    );
  }

  const dup = await db
    .select({ id: mcpServerWorkflows.id })
    .from(mcpServerWorkflows)
    .where(
      and(
        eq(mcpServerWorkflows.mcpServerId, server.id),
        eq(mcpServerWorkflows.workflowTemplateId, body.workflowId)
      )
    )
    .limit(1);

  if (dup[0]) {
    return NextResponse.json({ error: "This workflow is already added" }, { status: 400 });
  }

  const maxOrder = await db
    .select({ maxOrder: max(mcpServerWorkflows.sortOrder) })
    .from(mcpServerWorkflows)
    .where(eq(mcpServerWorkflows.mcpServerId, server.id));

  const nextOrder = (maxOrder[0]?.maxOrder ?? -1) + 1;

  const inserted = await db
    .insert(mcpServerWorkflows)
    .values({
      mcpServerId: server.id,
      workflowTemplateId: workflow.id,
      toolName: (body.toolName ?? workflow.name).slice(0, 120),
      description: body.toolDescription ?? workflow.description ?? null,
      enabled: true,
      sortOrder: nextOrder
    })
    .returning();

  const serverWorkflow = inserted[0];
  if (!serverWorkflow) {
    return NextResponse.json({ error: "Failed to add workflow" }, { status: 500 });
  }

  const summary = workflowTemplateSummary(workflow);

  return NextResponse.json(
    {
      workflow: {
        id: serverWorkflow.id,
        toolName: serverWorkflow.toolName,
        toolDescription: serverWorkflow.description,
        isEnabled: serverWorkflow.enabled,
        displayOrder: serverWorkflow.sortOrder,
        workflow: summary
      }
    },
    { status: 201 }
  );
});
