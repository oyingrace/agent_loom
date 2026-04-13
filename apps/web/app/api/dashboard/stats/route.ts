import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  apiProxies,
  requestLogs,
  workflowTemplates
} from "@agent-loom/database";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/auth/withAuth";
import { z } from "zod";

const querySchema = z.object({
  period: z.enum(["all", "7d", "30d"]).default("all")
});

/**
 * GET /api/dashboard/stats — Aggregated proxy + workflow metrics (owner session).
 */
export const GET = withAuth(async (user, request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    period: searchParams.get("period") || undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { period } = parsed.data;
  let dateThreshold: Date | null = null;
  if (period === "7d") {
    dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - 7);
  } else if (period === "30d") {
    dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - 30);
  }

  const db = getDb();

  const [wfRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(workflowTemplates)
    .where(eq(workflowTemplates.ownerUserId, user.id));

  const workflowCount = wfRow?.c ?? 0;

  const userProxies = await db
    .select()
    .from(apiProxies)
    .where(eq(apiProxies.ownerUserId, user.id));

  if (userProxies.length === 0) {
    return NextResponse.json({
      totals: {
        apiCount: 0,
        workflowCount,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalEarnings: 0
      },
      perProxy: [],
      recentLogs: []
    });
  }

  const proxyIds = userProxies.map((p) => p.id);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    request.nextUrl.origin;

  const logWhere = dateThreshold
    ? and(
        inArray(requestLogs.proxyId, proxyIds),
        gte(requestLogs.createdAt, dateThreshold)
      )
    : inArray(requestLogs.proxyId, proxyIds);

  const metricsQuery = await db
    .select({
      proxyId: requestLogs.proxyId,
      total: sql<number>`count(*)::int`,
      successful: sql<number>`count(*) filter (where ${requestLogs.statusCode} >= 200 and ${requestLogs.statusCode} < 300)::int`,
      failed: sql<number>`count(*) filter (where ${requestLogs.statusCode} < 200 or ${requestLogs.statusCode} >= 400)::int`
    })
    .from(requestLogs)
    .where(logWhere)
    .groupBy(requestLogs.proxyId);

  const metricsMap = new Map(metricsQuery.map((m) => [m.proxyId, m]));

  const perProxy = userProxies.map((proxy) => {
    const metrics = metricsMap.get(proxy.id) ?? {
      total: 0,
      successful: 0,
      failed: 0
    };
    const price = Number.parseFloat(proxy.pricingAmount);
    const earnings = Number.isFinite(price) ? metrics.successful * price : 0;

    return {
      id: proxy.id,
      slug: proxy.slug,
      name: proxy.name,
      proxyUrl: `${baseUrl}/api/proxy/${proxy.slug}`,
      pricingAmount: proxy.pricingAmount,
      pricingAsset: proxy.pricingAsset,
      totalRequests: metrics.total,
      successfulRequests: metrics.successful,
      failedRequests: metrics.failed,
      earnings,
      lastRequestAt: null as string | null
    };
  });

  const totals = {
    apiCount: userProxies.length,
    workflowCount,
    totalRequests: perProxy.reduce((s, p) => s + p.totalRequests, 0),
    successfulRequests: perProxy.reduce((s, p) => s + p.successfulRequests, 0),
    failedRequests: perProxy.reduce((s, p) => s + p.failedRequests, 0),
    totalEarnings: perProxy.reduce((s, p) => s + p.earnings, 0)
  };

  const recentRows = await db
    .select({
      id: requestLogs.id,
      proxyId: requestLogs.proxyId,
      statusCode: requestLogs.statusCode,
      createdAt: requestLogs.createdAt
    })
    .from(requestLogs)
    .where(inArray(requestLogs.proxyId, proxyIds))
    .orderBy(desc(requestLogs.createdAt))
    .limit(20);

  const nameMap = new Map(userProxies.map((p) => [p.id, p.name]));
  const recentLogs = recentRows.map((log) => ({
    id: log.id,
    proxyId: log.proxyId,
    proxyName: nameMap.get(log.proxyId) ?? "Unknown",
    statusCode: log.statusCode,
    timestamp: log.createdAt.toISOString()
  }));

  return NextResponse.json({
    totals,
    perProxy,
    recentLogs
  });
});
