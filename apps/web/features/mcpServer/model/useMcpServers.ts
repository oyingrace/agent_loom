"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type {
  McpServersFilters,
  McpServersResponse,
  McpServerSortOption
} from "./types";

const ITEMS_PER_PAGE = 12;

async function fetchMcpServers(filters: McpServersFilters): Promise<McpServersResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  params.set("sortBy", filters.sortBy);
  params.set("page", filters.page.toString());
  params.set("limit", ITEMS_PER_PAGE.toString());

  const response = await fetch(`/api/mcp-servers?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch MCP servers");
  }
  return response.json();
}

export function useMcpServers() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: McpServersFilters = useMemo(
    () => ({
      search: searchParams.get("search") || "",
      sortBy: (searchParams.get("sortBy") as McpServerSortOption) || "newest",
      page: parseInt(searchParams.get("page") || "1", 10)
    }),
    [searchParams]
  );

  const updateFilters = useCallback(
    (newFilters: Partial<McpServersFilters>) => {
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
    queryKey: ["mcp-servers", filters],
    queryFn: () => fetchMcpServers(filters),
    staleTime: 30_000
  });

  const setSearch = useCallback(
    (search: string) => {
      updateFilters({ search });
    },
    [updateFilters]
  );

  const setSortBy = useCallback(
    (sortBy: McpServerSortOption) => {
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
    updateFilters({ search: "", sortBy: "newest", page: 1 });
  }, [updateFilters]);

  const hasFilters = Boolean(filters.search || filters.sortBy !== "newest");

  return {
    servers: data?.servers || [],
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
    setSortBy,
    setPage,
    clearFilters
  };
}
