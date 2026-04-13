"use client";

import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AvailableProxy, McpServerTool } from "@/features/mcpServer/model/types";
import { formatLoomPrice } from "@/lib/formatting/loomPrice";

interface ToolsManagementCardProps {
  tools: McpServerTool[];
  filteredProxies: AvailableProxy[];
  availableProxiesCount: number;
  categories: string[];
  searchQuery: string;
  selectedCategory: string;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onAddTool: (proxyId: string) => void;
  onRemoveTool: (toolId: string) => void;
}

function EnabledToolItem({
  tool,
  onRemove
}: {
  tool: McpServerTool;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="font-medium">{tool.apiProxy.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {formatLoomPrice(
              tool.apiProxy.pricingAsset,
              tool.apiProxy.pricingAmount
            )}{" "}
            min.
          </span>
          {tool.apiProxy.category ? (
            <Badge variant="secondary" className="text-xs">
              {tool.apiProxy.category}
            </Badge>
          ) : null}
        </div>
      </div>
      <Button variant="ghost" size="icon" type="button" onClick={onRemove}>
        <Trash2 className="text-destructive size-4" />
      </Button>
    </div>
  );
}

function AvailableProxyItem({
  proxy,
  onAdd
}: {
  proxy: AvailableProxy;
  onAdd: () => void;
}) {
  return (
    <div className="hover:bg-muted/50 flex items-center justify-between rounded-lg border border-dashed p-3 transition-colors hover:border-solid">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{proxy.name}</p>
          {proxy.isOwn ? (
            <Badge variant="outline" className="shrink-0 text-xs">
              Your API
            </Badge>
          ) : null}
        </div>
        {proxy.description ? (
          <p className="text-muted-foreground mt-0.5 truncate text-sm">
            {proxy.description}
          </p>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {formatLoomPrice(proxy.pricingAsset, proxy.pricingAmount)} min.
          </span>
          {proxy.category ? (
            <Badge variant="secondary" className="text-xs">
              {proxy.category}
            </Badge>
          ) : null}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        type="button"
        className="ml-2 shrink-0"
        onClick={onAdd}
      >
        <Plus className="mr-1 size-4" />
        Add
      </Button>
    </div>
  );
}

export function ToolsManagementCard({
  tools,
  filteredProxies,
  availableProxiesCount,
  categories,
  searchQuery,
  selectedCategory,
  onSearchChange,
  onCategoryChange,
  onAddTool,
  onRemoveTool
}: ToolsManagementCardProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tools ({tools.length})</CardTitle>
        <CardDescription>
          Expose API proxies as tools on this MCP server
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tools.length > 0 ? (
          <div className="space-y-2">
            <Label>Enabled tools</Label>
            <div className="space-y-2">
              {tools.map((tool) => (
                <EnabledToolItem
                  key={tool.id}
                  tool={tool}
                  onRemove={() => onRemoveTool(tool.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Add from marketplace</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search APIs…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className={cn(
                "border-input h-9 w-[180px] rounded-md border bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
              )}
              aria-label="Category"
            >
              <option value="all">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredProxies.length > 0 ? (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {filteredProxies.map((proxy) => (
              <AvailableProxyItem
                key={proxy.id}
                proxy={proxy}
                onAdd={() => onAddTool(proxy.id)}
              />
            ))}
          </div>
        ) : availableProxiesCount === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <p>No APIs available yet.</p>
            <Button
              variant="outline"
              type="button"
              className="mt-4"
              onClick={() => router.push("/proxies/new")}
            >
              Create an API proxy
            </Button>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            <p>No APIs match your filters.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
