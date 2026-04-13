import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { apiProxies } from "@agent-loom/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProxyUrlDisplay } from "@/features/explore/view/ProxyUrlDisplay";
import { getCategoryById } from "@/features/proxy/model/tags";
import { MethodBadge } from "@/features/proxy/view/MethodBadge";
import type { HttpMethod } from "@/features/proxy/model/variables";
import { formatLoomPrice } from "@/lib/formatting/loomPrice";
import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/isUuid";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function fetchPublicProxy(idOrSlug: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: apiProxies.id,
      slug: apiProxies.slug,
      name: apiProxies.name,
      description: apiProxies.description,
      pricingAsset: apiProxies.pricingAsset,
      pricingAmount: apiProxies.pricingAmount,
      category: apiProxies.category,
      tags: apiProxies.tags,
      httpMethod: apiProxies.httpMethod
    })
    .from(apiProxies)
    .where(
      and(
        isUuid(idOrSlug) ? eq(apiProxies.id, idOrSlug) : eq(apiProxies.slug, idOrSlug),
        eq(apiProxies.isPublic, true),
        eq(apiProxies.isActive, true)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export default async function ExploreDetailPage({ params }: PageProps) {
  const { id } = await params;
  const api = await fetchPublicProxy(id);

  if (!api) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const proxyUrl = `${baseUrl.replace(/\/$/, "")}/api/proxy/${api.slug || api.id}`;
  const category = api.category ? getCategoryById(api.category) ?? null : null;
  const tags = (api.tags as string[]) || [];
  const httpMethod = (api.httpMethod || "GET") as HttpMethod;

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <Link href="/explore">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Marketplace
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <MethodBadge method={httpMethod} />
              <h1 className="text-3xl font-bold">{api.name}</h1>
            </div>
            {api.description ? (
              <p className="text-muted-foreground text-lg">{api.description}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-primary text-2xl font-bold">
              {formatLoomPrice(api.pricingAsset, api.pricingAmount)}
            </div>
            <div className="text-muted-foreground text-sm">per request (min.)</div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {category ? (
            <Badge variant="default" className="gap-1">
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </Badge>
          ) : null}
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">Gateway URL</p>
        <ProxyUrlDisplay proxyUrl={proxyUrl} />
        <p className="text-muted-foreground mt-4 text-sm">
          Call this URL with a valid Stellar x402 <code className="text-xs">X-PAYMENT</code> header
          after paying the required amount to the memo for this proxy.
        </p>
      </div>
    </div>
  );
}
