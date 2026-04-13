import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { workflowTemplates } from "@agent-loom/database";
import type { WorkflowDefinition } from "@agent-loom/workflow";
import { validateWorkflow } from "@agent-loom/workflow";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const user = await getCurrentUser();

  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user && row.ownerUserId === user.id) {
    return NextResponse.json({ workflow: row, role: "owner" as const });
  }

  if (row.isPublic) {
    return NextResponse.json({ workflow: row, role: "public" as const });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const db = getDb();
  const existingRows = await db
    .select()
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.id, id),
        eq(workflowTemplates.ownerUserId, user.id)
      )
    )
    .limit(1);

  if (!existingRows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    workflowDefinition?: unknown;
    isPublic?: boolean;
  };

  const updates: {
    name?: string;
    description?: string | null;
    workflowDefinition?: Record<string, unknown>;
    isPublic?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.description !== undefined) {
    updates.description = body.description;
  }
  if (body.isPublic !== undefined) {
    updates.isPublic = body.isPublic;
  }
  if (body.workflowDefinition !== undefined) {
    const validation = validateWorkflow(body.workflowDefinition as WorkflowDefinition);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid workflow definition", details: validation.errors },
        { status: 400 }
      );
    }
    updates.workflowDefinition = body.workflowDefinition as unknown as Record<
      string,
      unknown
    >;
  }

  const [workflow] = await db
    .update(workflowTemplates)
    .set(updates)
    .where(eq(workflowTemplates.id, id))
    .returning();

  return NextResponse.json({ workflow });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const db = getDb();
  const existingRows = await db
    .select({ id: workflowTemplates.id })
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.id, id),
        eq(workflowTemplates.ownerUserId, user.id)
      )
    )
    .limit(1);

  if (!existingRows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));
  return NextResponse.json({ success: true });
}
