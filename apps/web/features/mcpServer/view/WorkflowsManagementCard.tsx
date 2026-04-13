"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Search, Trash2, Workflow } from "lucide-react";
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
import type {
  McpServerWorkflow,
  WorkflowTemplateInfo
} from "@/features/mcpServer/model/types";
import type { AvailableWorkflow } from "@/features/mcpServer/model/useMcpServer";

interface WorkflowsManagementCardProps {
  workflows: McpServerWorkflow[];
  availableWorkflows: AvailableWorkflow[];
  onAddWorkflow: (workflowId: string) => Promise<void>;
  onRemoveWorkflow: (id: string) => Promise<void>;
}

function getWorkflowTemplate(mw: McpServerWorkflow): WorkflowTemplateInfo | null {
  return mw.workflow || mw.template || null;
}

export function WorkflowsManagementCard({
  workflows,
  availableWorkflows,
  onAddWorkflow,
  onRemoveWorkflow
}: WorkflowsManagementCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const filteredAvailable = availableWorkflows
    .filter((w) => !workflows.some((mw) => getWorkflowTemplate(mw)?.id === w.id))
    .filter((w) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        w.slug.toLowerCase().includes(q) ||
        (w.description?.toLowerCase().includes(q) ?? false)
      );
    });

  const handleAdd = async (workflowId: string) => {
    setIsAdding(workflowId);
    try {
      await onAddWorkflow(workflowId);
    } finally {
      setIsAdding(null);
    }
  };

  const handleRemove = async (id: string) => {
    setIsRemoving(id);
    try {
      await onRemoveWorkflow(id);
    } finally {
      setIsRemoving(null);
    }
  };

  const getStepTypeBadge = (steps: { type: string }[]) => {
    const hasOnchain = steps.some(
      (s) => s.type === "onchain" || s.type === "onchain_batch"
    );
    const hasHttp = steps.some((s) => s.type === "http");

    if (hasOnchain && hasHttp) {
      return <Badge variant="default">hybrid</Badge>;
    }
    if (hasOnchain) {
      return <Badge variant="default">on-chain</Badge>;
    }
    return <Badge variant="secondary">http</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="size-5" />
              Workflow tools
            </CardTitle>
            <CardDescription>
              Workflows exposed as tools through this MCP server
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/workflows/new">
              <Plus className="mr-1 size-4" />
              New workflow
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            Enabled workflows ({workflows.length})
          </h4>
          {workflows.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed py-6 text-center">
              No workflows yet. Add public or your own templates below.
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map((mw) => {
                const template = getWorkflowTemplate(mw);
                if (!template) return null;

                return (
                  <div
                    key={mw.id}
                    className="bg-muted/30 flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {mw.toolName || template.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {(template.inputSchema?.length ?? 0)} inputs
                        </Badge>
                      </div>
                      <p className="text-muted-foreground truncate text-sm">
                        {mw.toolDescription ||
                          template.description ||
                          template.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/workflows/${template.id}`}>
                          <ExternalLink className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => handleRemove(mw.id)}
                        disabled={isRemoving === mw.id}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-medium">Available workflows</h4>

          {availableWorkflows.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed py-6 text-center">
              <p>No workflows found.</p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/workflows/new">Create a workflow</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {filteredAvailable.length === 0 ? (
                <div className="text-muted-foreground py-6 text-center">
                  {searchQuery
                    ? "No workflows match your search"
                    : "All matching workflows are already added"}
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {filteredAvailable.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="hover:bg-muted/30 flex items-center justify-between rounded-lg border p-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{workflow.name}</span>
                          {getStepTypeBadge(workflow.workflowDefinition.steps)}
                        </div>
                        <p className="text-muted-foreground truncate text-sm">
                          {workflow.description || workflow.id.slice(0, 8)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => handleAdd(workflow.id)}
                        disabled={isAdding === workflow.id}
                      >
                        <Plus className="mr-1 size-4" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
