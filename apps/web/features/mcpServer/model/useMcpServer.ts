"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import type {
  AvailableProxy,
  McpServer,
  McpServerFormData,
  McpServerTool,
  McpServerWorkflow
} from "./types";

interface McpServerResponse {
  server: McpServer | null;
  tools: McpServerTool[];
}

interface ProxiesResponse {
  proxies: AvailableProxy[];
  categories: string[];
}

interface WorkflowsResponse {
  workflows: McpServerWorkflow[];
}

export interface AvailableWorkflow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  inputSchema: { name: string; type: string }[];
  workflowDefinition: {
    steps: { type: string }[];
  };
}

function normalizeWorkflowRow(w: {
  id: string;
  name: string;
  description: string | null;
  workflowDefinition: Record<string, unknown>;
}): AvailableWorkflow {
  const def = w.workflowDefinition as { steps?: { type?: string }[] };
  const steps = Array.isArray(def?.steps)
    ? def.steps.map((s) => ({ type: s?.type ?? "unknown" }))
    : [];
  return {
    id: w.id,
    name: w.name,
    slug: w.id,
    description: w.description,
    inputSchema: [],
    workflowDefinition: { steps }
  };
}

async function fetchMcpServer(): Promise<McpServerResponse> {
  const response = await fetch("/api/mcp-server", { credentials: "include" });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authenticated");
    }
    throw new Error("Failed to fetch MCP server");
  }
  const data = (await response.json()) as McpServerResponse;
  return {
    server: data.server ?? null,
    tools: data.tools ?? []
  };
}

async function fetchAvailableProxies(): Promise<ProxiesResponse> {
  const response = await fetch("/api/proxies/available", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch available proxies");
  }
  const data = (await response.json()) as ProxiesResponse;
  return {
    proxies: data.proxies ?? [],
    categories: data.categories ?? []
  };
}

async function saveServer(
  data: McpServerFormData,
  isUpdate: boolean
): Promise<{ server: McpServer }> {
  const response = await fetch("/api/mcp-server", {
    method: isUpdate ? "PUT" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Failed to save server");
  }

  return response.json() as Promise<{ server: McpServer }>;
}

async function addTool(proxyId: string): Promise<{ tool: McpServerTool }> {
  const response = await fetch("/api/mcp-server/tools", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proxyId })
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Failed to add tool");
  }

  return response.json() as Promise<{ tool: McpServerTool }>;
}

async function removeTool(toolId: string): Promise<void> {
  const response = await fetch(`/api/mcp-server/tools/${toolId}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Failed to remove tool");
  }
}

async function fetchMcpServerWorkflows(): Promise<WorkflowsResponse> {
  const response = await fetch("/api/mcp-server/workflows", {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error("Failed to fetch MCP server workflows");
  }
  return response.json() as Promise<WorkflowsResponse>;
}

async function fetchAvailableWorkflows(): Promise<{ workflows: AvailableWorkflow[] }> {
  const [mineRes, pubRes] = await Promise.all([
    fetch("/api/workflows", { credentials: "include" }),
    fetch("/api/workflows/public?limit=200", { credentials: "include" })
  ]);

  if (!mineRes.ok) {
    throw new Error("Failed to fetch your workflows");
  }
  if (!pubRes.ok) {
    throw new Error("Failed to fetch public workflows");
  }

  const mine = (await mineRes.json()) as {
    workflows: {
      id: string;
      name: string;
      description: string | null;
      workflowDefinition: Record<string, unknown>;
    }[];
  };
  const pub = (await pubRes.json()) as {
    workflows: {
      id: string;
      name: string;
      description: string | null;
      workflowDefinition: Record<string, unknown>;
    }[];
  };

  const merged = new Map<string, AvailableWorkflow>();
  for (const w of mine.workflows ?? []) {
    merged.set(w.id, normalizeWorkflowRow(w));
  }
  for (const w of pub.workflows ?? []) {
    if (!merged.has(w.id)) {
      merged.set(w.id, normalizeWorkflowRow(w));
    }
  }

  return { workflows: [...merged.values()] };
}

async function addWorkflowToServer(workflowId: string): Promise<McpServerWorkflow> {
  const response = await fetch("/api/mcp-server/workflows", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflowId })
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Failed to add workflow");
  }

  const data = (await response.json()) as { workflow: McpServerWorkflow };
  return data.workflow;
}

async function removeWorkflowFromServer(id: string): Promise<void> {
  const response = await fetch(`/api/mcp-server/workflows/${id}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Failed to remove workflow");
  }
}

export function useMcpServer() {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<McpServerFormData>({
    slug: "",
    name: "",
    description: "",
    isPublic: false
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const serverQuery = useQuery({
    queryKey: ["mcp-server"],
    queryFn: fetchMcpServer,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === "Not authenticated") {
        return false;
      }
      return failureCount < 3;
    }
  });

  const proxiesQuery = useQuery({
    queryKey: ["available-proxies"],
    queryFn: fetchAvailableProxies,
    staleTime: 60_000
  });

  const serverWorkflowsQuery = useQuery({
    queryKey: ["mcp-server-workflows"],
    queryFn: fetchMcpServerWorkflows,
    staleTime: 60_000,
    enabled: !!serverQuery.data?.server
  });

  const availableWorkflowsQuery = useQuery({
    queryKey: ["workflows-available-for-mcp"],
    queryFn: fetchAvailableWorkflows,
    staleTime: 60_000
  });

  const initializeForm = useCallback((server: McpServer) => {
    setFormData({
      slug: server.slug,
      name: server.name,
      description: server.description || "",
      isPublic: server.isPublic
    });
  }, []);

  const server = serverQuery.data?.server ?? null;
  const tools = serverQuery.data?.tools ?? [];
  const availableProxies = proxiesQuery.data?.proxies ?? [];
  const categories = proxiesQuery.data?.categories ?? [];
  const serverWorkflows = serverWorkflowsQuery.data?.workflows ?? [];
  const availableWorkflows = availableWorkflowsQuery.data?.workflows ?? [];

  const filteredProxies = useMemo(() => {
    let filtered = availableProxies;
    filtered = filtered.filter((p) => !tools.some((t) => t.apiProxy.id === p.id));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false)
      );
    }

    if (selectedCategory && selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    return filtered;
  }, [availableProxies, tools, searchQuery, selectedCategory]);

  const saveMutation = useMutation({
    mutationFn: (data: McpServerFormData) => saveServer(data, !!server),
    onSuccess: (result) => {
      queryClient.setQueryData(["mcp-server"], (old: McpServerResponse | undefined) => ({
        server: result.server,
        tools: old?.tools ?? []
      }));
    }
  });

  const addToolMutation = useMutation({
    mutationFn: addTool,
    onSuccess: (result) => {
      queryClient.setQueryData(["mcp-server"], (old: McpServerResponse | undefined) => ({
        server: old?.server ?? null,
        tools: [...(old?.tools ?? []), result.tool]
      }));
    }
  });

  const removeToolMutation = useMutation({
    mutationFn: removeTool,
    onSuccess: (_, toolId) => {
      queryClient.setQueryData(["mcp-server"], (old: McpServerResponse | undefined) => ({
        server: old?.server ?? null,
        tools: (old?.tools ?? []).filter((t) => t.id !== toolId)
      }));
    }
  });

  const addWorkflowMutation = useMutation({
    mutationFn: addWorkflowToServer,
    onSuccess: (result) => {
      queryClient.setQueryData(["mcp-server-workflows"], (old: WorkflowsResponse | undefined) => ({
        workflows: [...(old?.workflows ?? []), result]
      }));
    }
  });

  const removeWorkflowMutation = useMutation({
    mutationFn: removeWorkflowFromServer,
    onSuccess: (_, workflowId) => {
      queryClient.setQueryData(["mcp-server-workflows"], (old: WorkflowsResponse | undefined) => ({
        workflows: (old?.workflows ?? []).filter((w) => w.id !== workflowId)
      }));
    }
  });

  const handleSave = useCallback(async () => {
    if (!formData.slug || !formData.name) {
      throw new Error("Slug and name are required");
    }

    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      throw new Error("Slug must be lowercase letters, numbers, and hyphens only");
    }

    return saveMutation.mutateAsync(formData);
  }, [formData, saveMutation]);

  const handleAddTool = useCallback(
    async (proxyId: string) => {
      if (!server) {
        throw new Error("Server must be created first");
      }
      return addToolMutation.mutateAsync(proxyId);
    },
    [server, addToolMutation]
  );

  const handleRemoveTool = useCallback(
    async (toolId: string) => {
      return removeToolMutation.mutateAsync(toolId);
    },
    [removeToolMutation]
  );

  const handleAddWorkflow = useCallback(
    async (workflowId: string) => {
      if (!server) {
        throw new Error("Server must be created first");
      }
      return addWorkflowMutation.mutateAsync(workflowId);
    },
    [server, addWorkflowMutation]
  );

  const handleRemoveWorkflow = useCallback(
    async (id: string) => {
      return removeWorkflowMutation.mutateAsync(id);
    },
    [removeWorkflowMutation]
  );

  const copyConnectionUrl = useCallback(() => {
    if (!server) return;
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${base}/mcp/${server.slug}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [server]);

  const updateFormField = useCallback(
    <K extends keyof McpServerFormData>(field: K, value: McpServerFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  return {
    server,
    tools,
    availableProxies,
    filteredProxies,
    categories,
    serverWorkflows,
    availableWorkflows,
    isLoading: serverQuery.isLoading || proxiesQuery.isLoading,
    isSaving: saveMutation.isPending,
    isAddingTool: addToolMutation.isPending,
    isRemovingTool: removeToolMutation.isPending,
    isAddingWorkflow: addWorkflowMutation.isPending,
    isRemovingWorkflow: removeWorkflowMutation.isPending,
    error: serverQuery.error || proxiesQuery.error,
    saveError: saveMutation.error,
    addToolError: addToolMutation.error,
    removeToolError: removeToolMutation.error,
    addWorkflowError: addWorkflowMutation.error,
    removeWorkflowError: removeWorkflowMutation.error,
    formData,
    setFormData,
    updateFormField,
    initializeForm,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    copied,
    saveServer: handleSave,
    addTool: handleAddTool,
    removeTool: handleRemoveTool,
    addWorkflow: handleAddWorkflow,
    removeWorkflow: handleRemoveWorkflow,
    copyConnectionUrl
  };
}
