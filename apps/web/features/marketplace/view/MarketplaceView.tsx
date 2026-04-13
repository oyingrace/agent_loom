"use client";

import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProxyList } from "@/features/proxy/view/ProxyList";
import { useMarketplace } from "@/features/marketplace/model/useMarketplace";
import { MarketplaceFilters } from "@/features/marketplace/view/MarketplaceFilters";
import { MarketplacePagination } from "@/features/marketplace/view/MarketplacePagination";

export function MarketplaceView() {
  const {
    proxies,
    pagination,
    isLoading,
    error,
    filters,
    hasFilters,
    setSearch,
    setCategory,
    addTag,
    removeTag,
    setSortBy,
    setPage,
    clearFilters
  } = useMarketplace();

  return (
    <div className="container space-y-6 py-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">API Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            Discover and use Stellar payment-gated APIs (x402)
          </p>
        </div>
        <Link href="/proxies/new">
          <Button className="gap-2">
            <Plus className="size-4" />
            Create API
          </Button>
        </Link>
      </div>

      <MarketplaceFilters
        filters={filters}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onSortChange={setSortBy}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      {error ? (
        <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg p-4">
          <AlertCircle className="size-5" />
          <span>Failed to load APIs. Please try again.</span>
        </div>
      ) : null}

      {!error ? (
        <>
          <ProxyList
            proxies={proxies}
            isLoading={isLoading}
            emptyMessage={
              hasFilters
                ? "No APIs match your filters. Try adjusting your search criteria."
                : "No APIs available yet. Be the first to create one!"
            }
          />

          {!isLoading && proxies.length === 0 && !hasFilters ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Link href="/proxies/new">
                <Button size="lg" className="gap-2">
                  <Plus className="size-5" />
                  Create Your First API
                </Button>
              </Link>
            </div>
          ) : null}

          <MarketplacePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
