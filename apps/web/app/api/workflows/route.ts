import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { workflowTemplates } from "@agent-loom/database";
import type { WorkflowDefinition } from "@agent-loom/workflow";
import { validateWorkflow } from "@agent-loom/workflow";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const workflows = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.ownerUserId, user.id))
    .orderBy(desc(workflowTemplates.createdAt));

  return NextResponse.json({ workflows });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    workflowDefinition?: unknown;
    isPublic?: boolean;
  };

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!body.workflowDefinition || typeof body.workflowDefinition !== "object") {
    return NextResponse.json(
      { error: "workflowDefinition is required" },
      { status: 400 }
    );
  }

  const validation = validateWorkflow(body.workflowDefinition as WorkflowDefinition);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid workflow definition", details: validation.errors },
      { status: 400 }
    );
  }

  const db = getDb();
  const [workflow] = await db
    .insert(workflowTemplates)
    .values({
      ownerUserId: user.id,
      name: body.name,
      description: body.description ?? null,
      workflowDefinition: body.workflowDefinition as unknown as Record<
        string,
        unknown
      >,
      isPublic: body.isPublic ?? false
    })
    .returning();

  if (!workflow) {
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }

  return NextResponse.json({ workflow }, { status: 201 });
}
