"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMcpServers } from "@/features/mcpServer/model/useMcpServers";
import type { McpServerSortOption } from "@/features/mcpServer/model/types";
import { McpServerCard } from "@/features/mcpServer/view/McpServerCard";
import { McpServersPagination } from "@/features/mcpServer/view/McpServersPagination";

const sortOptions: { value: McpServerSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "tools", label: "Most tools" },
  { value: "workflows", label: "Most workflows" }
];

export function McpServersView() {
  const {
    servers,
    pagination,
    isLoading,
    filters,
    hasFilters,
    setSearch,
    setSortBy,
    setPage,
    clearFilters
  } = useMcpServers();

  const [searchInput, setSearchInput] = useState(filters.search);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearch(searchInput);
    },
    [searchInput, setSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
  }, [setSearch]);

  return (
    <div className="container space-y-8 py-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">MCP Servers</h1>
          <p className="text-muted-foreground mt-2">
            Discover AI-ready MCP servers with tools and workflows for your agents
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/mcp" className="gap-2">
            <Plus className="size-4" />
            Create MCP server
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search MCP servers..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pr-10 pl-10"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <select
          value={filters.sortBy}
          onChange={(e) => setSortBy(e.target.value as McpServerSortOption)}
          className={cn(
            "border-input h-9 w-full rounded-md border bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none sm:w-[200px]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
          )}
          aria-label="Sort MCP servers"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {hasFilters ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Filters active:</span>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
        </div>
      ) : servers.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <McpServerCard key={server.id} server={server} />
            ))}
          </div>

          {pagination.totalPages > 1 ? (
            <McpServersPagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            {hasFilters
              ? "No MCP servers found matching your filters."
              : "No public MCP servers available yet."}
          </p>
          {hasFilters ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <p className="text-muted-foreground max-w-md text-sm">
              When builders publish MCP servers on Agent Loom, they will appear here for anyone to
              discover.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
