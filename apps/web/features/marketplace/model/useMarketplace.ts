"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { MarketplaceProxy } from "@/features/marketplace/model/types";

export type SortOption = "newest" | "oldest" | "price_low" | "price_high";

export interface MarketplaceFilters {
  search: string;
  category: string | null;
  tags: string[];
  sortBy: SortOption;
  page: number;
}

export interface MarketplaceResponse {
  proxies: MarketplaceProxy[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const ITEMS_PER_PAGE = 12;

async function fetchMarketplace(filters: MarketplaceFilters): Promise<MarketplaceResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  params.set("sortBy", filters.sortBy);
  params.set("page", filters.page.toString());
  params.set("limit", ITEMS_PER_PAGE.toString());

  const response = await fetch(`/api/marketplace?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch marketplace data");
  }
  return response.json();
}

export function useMarketplace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: MarketplaceFilters = useMemo(
    () => ({
      search: searchParams.get("search") || "",
      category: searchParams.get("category") || null,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || [],
      sortBy: (searchParams.get("sortBy") as SortOption) || "newest",
      page: parseInt(searchParams.get("page") || "1", 10)
    }),
    [searchParams]
  );

  const updateFilters = useCallback(
    (newFilters: Partial<MarketplaceFilters>) => {
      const params = new URLSearchParams(searchParams.toString());
      const updated = { ...filters, ...newFilters };
      if (!("page" in newFilters)) {
        updated.page = 1;
      }

      if (updated.search) {
        params.set("search", updated.search);
      } else {
        params.delete("search");
      }

      if (updated.category) {
        params.set("category", updated.category);
      } else {
        params.delete("category");
      }

      if (updated.tags.length > 0) {
        params.set("tags", updated.tags.join(","));
      } else {
        params.delete("tags");
      }

      if (updated.sortBy !== "newest") {
        params.set("sortBy", updated.sortBy);
      } else {
        params.delete("sortBy");
      }

      if (updated.page > 1) {
        params.set("page", updated.page.toString());
      } else {
        params.delete("page");
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [filters, pathname, router, searchParams]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["marketplace", filters],
    queryFn: () => fetchMarketplace(filters),
    staleTime: 30_000
  });

  const setSearch = useCallback(
    (search: string) => {
      updateFilters({ search });
    },
    [updateFilters]
  );

  const setCategory = useCallback(
    (category: string | null) => {
      updateFilters({ category, tags: [] });
    },
    [updateFilters]
  );

  const addTag = useCallback(
    (tag: string) => {
      if (!filters.tags.includes(tag)) {
        updateFilters({ tags: [...filters.tags, tag] });
      }
    },
    [filters.tags, updateFilters]
  );

  const removeTag = useCallback(
    (tag: string) => {
      updateFilters({ tags: filters.tags.filter((t) => t !== tag) });
    },
    [filters.tags, updateFilters]
  );

  const setSortBy = useCallback(
    (sortBy: SortOption) => {
      updateFilters({ sortBy });
    },
    [updateFilters]
  );

  const setPage = useCallback(
    (page: number) => {
      updateFilters({ page });
    },
    [updateFilters]
  );

  const clearFilters = useCallback(() => {
    updateFilters({
      search: "",
      category: null,
      tags: [],
      sortBy: "newest",
      page: 1
    });
  }, [updateFilters]);

  const hasFilters = Boolean(
    filters.search ||
      filters.category ||
      filters.tags.length > 0 ||
      filters.sortBy !== "newest"
  );

  return {
    proxies: data?.proxies || [],
    pagination: data?.pagination || {
      page: 1,
      limit: ITEMS_PER_PAGE,
      total: 0,
      totalPages: 0
    },
    isLoading,
    error,
    refetch,
    filters,
    hasFilters,
    setSearch,
    setCategory,
    addTag,
    removeTag,
    setSortBy,
    setPage,
    clearFilters
  };
}
