"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CATEGORY_LIST, getTagsForCategory, type CategoryId } from "@/features/proxy/model/tags";
import type { MarketplaceFilters as Filters, SortOption } from "@/features/marketplace/model/useMarketplace";

interface MarketplaceFiltersProps {
  filters: Filters;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: string | null) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onSortChange: (sortBy: SortOption) => void;
  onClear: () => void;
  hasFilters: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" }
];

export function MarketplaceFilters({
  filters,
  onSearchChange,
  onCategoryChange,
  onAddTag,
  onRemoveTag,
  onSortChange,
  onClear,
  hasFilters
}: MarketplaceFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  useEffect(() => {
    setSearchValue(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onSearchChange(searchValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, filters.search, onSearchChange]);

  const suggestedTags = filters.category
    ? getTagsForCategory(filters.category as CategoryId).filter((t) => !filters.tags.includes(t))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search APIs..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={filters.category ?? "all"}
          onChange={(e) =>
            onCategoryChange(e.target.value === "all" ? null : e.target.value)
          }
          className={cn(
            "border-input h-9 w-full rounded-md border bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none sm:w-[200px]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
          )}
          aria-label="Category"
        >
          <option value="all">All categories</option>
          {CATEGORY_LIST.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.label}
            </option>
          ))}
        </select>

        <div className="relative w-full sm:w-[180px]">
          <SlidersHorizontal className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <select
            value={filters.sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className={cn(
              "border-input h-9 w-full rounded-md border bg-transparent py-1 pr-2 pl-8 text-sm shadow-xs outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
            )}
            aria-label="Sort"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.tags.map((tag) => (
          <Badge key={tag} variant="default" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => onRemoveTag(tag)}
              className="hover:bg-primary-foreground/20 rounded-full p-0.5"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}

        {suggestedTags.slice(0, 6).map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="hover:bg-secondary cursor-pointer"
            onClick={() => onAddTag(tag)}
          >
            + {tag}
          </Badge>
        ))}

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
            Clear all
          </Button>
        ) : null}
      </div>
    </div>
  );
}
