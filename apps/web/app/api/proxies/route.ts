import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiProxies } from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/auth/withAuth";
import { createProxySchema } from "@/lib/validations/proxy";

/**
 * GET /api/proxies — List proxies for the current user.
 */
export const GET = withAuth(async (user, _request: NextRequest) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(apiProxies)
    .where(eq(apiProxies.ownerUserId, user.id));
  return NextResponse.json({ proxies: rows });
});

/**
 * POST /api/proxies — Create a proxy.
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  const body = await request.json();
  const parsed = createProxySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = getDb();

  try {
    const inserted = await db
      .insert(apiProxies)
      .values({
        ownerUserId: user.id,
        name: data.name,
        slug: data.slug,
        targetUrl: data.targetUrl,
        pricingAsset: data.pricingAsset,
        pricingAmount: data.pricingAmount,
        payoutAddress: data.payoutAddress,
        encryptedHeaders: data.encryptedHeaders ?? null,
        inputSchema: data.inputSchema ?? null,
        outputSchema: data.outputSchema ?? null,
        isActive: data.isActive ?? true,
        isPublic: data.isPublic ?? true,
        description: data.description ?? null,
        category: data.category ?? null,
        tags: data.tags ?? [],
        httpMethod: data.httpMethod ?? "GET",
        variablesSchema: data.variablesSchema ?? [],
        requestBodyTemplate: data.requestBodyTemplate ?? null,
        queryParamsTemplate: data.queryParamsTemplate ?? null,
        contentType: data.contentType ?? "application/json",
        exampleResponse: data.exampleResponse ?? null
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: "Failed to create proxy" }, { status: 500 });
    }

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      request.nextUrl.origin;
    const proxyUrl = `${base}/api/proxy/${row.id}`;

    return NextResponse.json(
      {
        proxy: row,
        proxyUrl,
        proxyUrlBySlug: `${base}/api/proxy/${row.slug}`
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (msg === "23505") {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }
    console.error("[POST /api/proxies]", e);
    return NextResponse.json(
      { error: "Failed to create proxy" },
      { status: 500 }
    );
  }
});
