"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCategoryById } from "@/features/proxy/model/tags";
import { MethodBadge } from "@/features/proxy/view/MethodBadge";
import { formatLoomPrice } from "@/lib/formatting/loomPrice";
import type { MarketplaceProxy } from "@/features/marketplace/model/types";
import type { HttpMethod } from "@/features/proxy/model/variables";

interface ProxyCardProps {
  proxy: MarketplaceProxy;
  href?: string;
}

export function ProxyCard({ proxy, href }: ProxyCardProps) {
  const category = proxy.category ? getCategoryById(proxy.category) : null;
  const tags = proxy.tags ?? [];
  const linkHref = href ?? `/explore/${proxy.id}`;
  const method = (proxy.httpMethod || "GET") as HttpMethod;

  return (
    <Link href={linkHref} className="block h-full">
      <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <MethodBadge method={method} />
              </div>
              <CardTitle className="line-clamp-2 text-lg leading-tight">{proxy.name}</CardTitle>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-primary text-lg font-semibold">
                {formatLoomPrice(proxy.pricingAsset, proxy.pricingAmount)}
              </div>
              <div className="text-muted-foreground text-xs">per request</div>
            </div>
          </div>
          {proxy.description ? (
            <CardDescription className="mt-2 line-clamp-2">{proxy.description}</CardDescription>
          ) : null}
        </CardHeader>

        <CardContent className="flex-1 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {category ? (
              <Badge variant="default" className="gap-1">
                <span>{category.icon}</span>
                <span>{category.label}</span>
              </Badge>
            ) : null}
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 ? (
              <Badge variant="outline">+{tags.length - 3}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
