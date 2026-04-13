"use client";

import Link from "next/link";
import { Server, Workflow, Wrench } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { McpServerListing } from "@/features/mcpServer/model/types";

function truncateAccount(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function McpServerCard({ server }: { server: McpServerListing }) {
  return (
    <Link href={`/mcp-servers/${server.slug}`}>
      <Card className="group h-full transition-all duration-300 hover:border-primary/50 hover:shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-primary rounded-lg bg-primary/10 p-2 transition-colors group-hover:bg-primary/20">
              <Server className="size-5" />
            </div>
            <span className="text-muted-foreground text-xs" title={server.ownerAccount}>
              {truncateAccount(server.ownerAccount)}
            </span>
          </div>
          <CardTitle className="mt-3 line-clamp-1 text-lg">{server.name}</CardTitle>
          <CardDescription className="line-clamp-2 min-h-[2.5rem]">
            {server.description || "No description provided"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <Wrench className="size-3" />
                {server.toolCount} {server.toolCount === 1 ? "tool" : "tools"}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Workflow className="size-3" />
                {server.workflowCount}{" "}
                {server.workflowCount === 1 ? "workflow" : "workflows"}
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Created {formatDate(server.createdAt)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
