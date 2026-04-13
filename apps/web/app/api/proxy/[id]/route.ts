import type { NextRequest } from "next/server";
import { handleProxyRequest } from "@/lib/proxy/handleProxyRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return handleProxyRequest(request, id);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return handleProxyRequest(request, id);
}

export async function PUT(request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return handleProxyRequest(request, id);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return handleProxyRequest(request, id);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return handleProxyRequest(request, id);
}

export async function HEAD(request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return handleProxyRequest(request, id);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-PAYMENT, X-Variables"
    }
  });
}
