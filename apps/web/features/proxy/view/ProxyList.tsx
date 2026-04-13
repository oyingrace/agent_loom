"use client";

import { Loader2 } from "lucide-react";
import { ProxyCard } from "@/features/proxy/view/ProxyCard";
import type { MarketplaceProxy } from "@/features/marketplace/model/types";

interface ProxyListProps {
  proxies: MarketplaceProxy[];
  isLoading?: boolean;
  emptyMessage?: string;
  getHref?: (proxy: MarketplaceProxy) => string;
}

export function ProxyList({
  proxies,
  isLoading,
  emptyMessage = "No APIs found",
  getHref
}: ProxyListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  if (proxies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {proxies.map((proxy) => (
        <ProxyCard key={proxy.id} proxy={proxy} href={getHref?.(proxy)} />
      ))}
    </div>
  );
}
