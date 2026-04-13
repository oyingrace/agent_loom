"use client";

import { useEffect, useState } from "react";
import { Loader2, Server } from "lucide-react";
import { useMcpServer } from "@/features/mcpServer/model/useMcpServer";
import { ServerConfigCard } from "@/features/mcpServer/view/ServerConfigCard";
import { ConnectionInfoCard } from "@/features/mcpServer/view/ConnectionInfoCard";
import { ToolsManagementCard } from "@/features/mcpServer/view/ToolsManagementCard";
import { WorkflowsManagementCard } from "@/features/mcpServer/view/WorkflowsManagementCard";

export function McpServerView() {
  const {
    server,
    tools,
    filteredProxies,
    availableProxies,
    categories,
    serverWorkflows,
    availableWorkflows,
    isLoading,
    isSaving,
    formData,
    updateFormField,
    initializeForm,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    copied,
    saveServer,
    addTool,
    removeTool,
    addWorkflow,
    removeWorkflow,
    copyConnectionUrl
  } = useMcpServer();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (server) {
      initializeForm(server);
    }
  }, [server, initializeForm]);

  const showError = (msg: string) => {
    setError(msg);
    setSuccess(null);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSave = async () => {
    try {
      await saveServer();
      showSuccess(server ? "MCP server updated" : "MCP server created");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleAddTool = async (proxyId: string) => {
    try {
      await addTool(proxyId);
      showSuccess("Tool added");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add tool");
    }
  };

  const handleRemoveTool = async (toolId: string) => {
    try {
      await removeTool(toolId);
      showSuccess("Tool removed");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to remove tool");
    }
  };

  const handleAddWorkflow = async (workflowId: string) => {
    try {
      await addWorkflow(workflowId);
      showSuccess("Workflow added");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add workflow");
    }
  };

  const handleRemoveWorkflow = async (id: string) => {
    try {
      await removeWorkflow(id);
      showSuccess("Workflow removed");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to remove workflow");
    }
  };

  const handleCopyUrl = () => {
    copyConnectionUrl();
    showSuccess("URL copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl space-y-8 py-8">
      {error ? (
        <div className="bg-destructive/10 border-destructive text-destructive rounded-lg border px-4 py-3">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-green-500 bg-green-500/10 px-4 py-3 text-green-600">
          {success}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <Server className="size-8" />
        <div>
          <h1 className="text-3xl font-bold">MCP server</h1>
          <p className="text-muted-foreground mt-1">
            Configure your Model Context Protocol server for AI agents
          </p>
        </div>
      </div>

      <ServerConfigCard
        formData={formData}
        onFieldChange={updateFormField}
        onSave={handleSave}
        isSaving={isSaving}
        hasServer={!!server}
      />

      {server ? (
        <ConnectionInfoCard
          serverSlug={server.slug}
          copied={copied}
          onCopy={handleCopyUrl}
        />
      ) : null}

      {server ? (
        <ToolsManagementCard
          tools={tools}
          filteredProxies={filteredProxies}
          availableProxiesCount={availableProxies.length}
          categories={categories}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onSearchChange={setSearchQuery}
          onCategoryChange={setSelectedCategory}
          onAddTool={handleAddTool}
          onRemoveTool={handleRemoveTool}
        />
      ) : null}

      {server ? (
        <WorkflowsManagementCard
          workflows={serverWorkflows}
          availableWorkflows={availableWorkflows}
          onAddWorkflow={handleAddWorkflow}
          onRemoveWorkflow={handleRemoveWorkflow}
        />
      ) : null}
    </div>
  );
}
