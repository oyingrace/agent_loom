"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe,
  Loader2,
  Plus,
  Search,
  Workflow as WorkflowIcon,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  usePublicWorkflows,
  type PublicWorkflowItem,
  type PublicWorkflowSortOption
} from "@/features/workflows/model/usePublicWorkflows";

const sortOptions: { value: PublicWorkflowSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "steps", label: "Most steps" }
];

function getStepTypes(def: Record<string, unknown>): string[] {
  const steps = def.steps;
  if (!Array.isArray(steps)) return [];
  return steps.map((s) => {
    if (s && typeof s === "object" && "type" in s) {
      return String((s as { type: unknown }).type);
    }
    return "unknown";
  });
}

function getStepTypeBadgeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type) {
    case "http":
      return "secondary";
    case "onchain":
    case "onchain_batch":
    case "soroswap":
      return "default";
    default:
      return "outline";
  }
}

function PublicWorkflowCard({ workflow }: { workflow: PublicWorkflowItem }) {
  const def = workflow.workflowDefinition ?? {};
  const stepTypes = getStepTypes(def);
  const uniqueTypes = [...new Set(stepTypes)];

  return (
    <Link href={`/workflows/${workflow.id}`}>
      <Card className="group h-full cursor-pointer transition-colors hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="group-hover:text-primary truncate text-lg transition-colors">
                  {workflow.name}
                </CardTitle>
                <Globe className="text-muted-foreground size-4 shrink-0" />
              </div>
              <CardDescription className="font-mono text-sm">
                /{workflow.id.slice(0, 8)}…
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {workflow.description ? (
            <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">{workflow.description}</p>
          ) : null}
          <div className="mb-3 flex flex-wrap gap-2">
            {uniqueTypes.map((type) => (
              <Badge key={type} variant={getStepTypeBadgeVariant(type)}>
                {type === "onchain_batch" ? "batch" : type}
              </Badge>
            ))}
          </div>
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>
              {stepTypes.length} step{stepTypes.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function WorkflowsPagination({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        Previous
      </Button>
      <span className="text-muted-foreground text-sm">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Next
      </Button>
    </div>
  );
}

export function PublicWorkflowsView() {
  const {
    workflows,
    pagination,
    isLoading,
    filters,
    hasFilters,
    setSearch,
    setSortBy,
    setPage,
    clearFilters
  } = usePublicWorkflows();

  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

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
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground mt-2">
            Discover reusable workflow templates for AI agents
          </p>
        </div>
        <Button asChild>
          <Link href="/workflows/new" className="gap-2">
            <Plus className="size-4" />
            New workflow
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search workflows..."
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
          onChange={(e) => setSortBy(e.target.value as PublicWorkflowSortOption)}
          className={cn(
            "border-input h-9 w-full rounded-md border bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none sm:w-[180px]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
          )}
          aria-label="Sort workflows"
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
      ) : workflows.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((workflow) => (
              <PublicWorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>

          <WorkflowsPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />

          {pagination.total > 0 ? (
            <p className="text-muted-foreground text-center text-sm">
              Showing {workflows.length} of {pagination.total} public workflows
            </p>
          ) : null}
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <WorkflowIcon className="text-muted-foreground mx-auto mb-4 size-12" />
              <h3 className="mb-2 text-lg font-medium">
                {hasFilters ? "No workflows found" : "No public workflows yet"}
              </h3>
              <p className="text-muted-foreground mx-auto mb-6 max-w-md">
                {hasFilters
                  ? "No workflows match your filters. Try adjusting your search."
                  : "Be the first to create a public workflow that AI agents can use."}
              </p>
              {hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/workflows/new" className="gap-2">
                    <Plus className="size-4" />
                    Create your first workflow
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
