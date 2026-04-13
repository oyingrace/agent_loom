"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

export type PublicWorkflowSortOption = "newest" | "oldest" | "steps";

export interface PublicWorkflowItem {
  id: string;
  name: string;
  description: string | null;
  workflowDefinition: Record<string, unknown>;
  isPublic: boolean;
  ownerAccount: string;
  createdAt: string;
  updatedAt: string;
}

interface PublicWorkflowsFilters {
  search: string;
  sortBy: PublicWorkflowSortOption;
  page: number;
}

interface PublicWorkflowsResponse {
  workflows: PublicWorkflowItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const LIMIT = 12;

async function fetchPublicWorkflows(
  filters: PublicWorkflowsFilters
): Promise<PublicWorkflowsResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  params.set("sortBy", filters.sortBy);
  params.set("page", String(filters.page));
  params.set("limit", String(LIMIT));

  const response = await fetch(`/api/workflows/public?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch workflows");
  }
  return response.json();
}

export function usePublicWorkflows() {
  const [filters, setFilters] = useState<PublicWorkflowsFilters>({
    search: "",
    sortBy: "newest",
    page: 1
  });

  const query = useQuery({
    queryKey: ["public-workflows", filters],
    queryFn: () => fetchPublicWorkflows(filters),
    staleTime: 60_000
  });

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const setSortBy = useCallback((sortBy: PublicWorkflowSortOption) => {
    setFilters((prev) => ({ ...prev, sortBy, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ search: "", sortBy: "newest", page: 1 });
  }, []);

  const hasFilters = filters.search !== "" || filters.sortBy !== "newest";

  return {
    workflows: query.data?.workflows ?? [],
    pagination: query.data?.pagination ?? {
      page: 1,
      limit: LIMIT,
      total: 0,
      totalPages: 0
    },
    isLoading: query.isLoading,
    error: query.error,
    filters,
    hasFilters,
    setSearch,
    setSortBy,
    setPage,
    clearFilters
  };
}
