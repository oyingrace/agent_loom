export interface McpServerListing {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  ownerAccount: string;
  toolCount: number;
  workflowCount: number;
  createdAt: string;
  updatedAt: string;
}

export type McpServerSortOption = "newest" | "oldest" | "tools" | "workflows";

export interface McpServersFilters {
  search: string;
  sortBy: McpServerSortOption;
  page: number;
}

export interface McpServersResponse {
  servers: McpServerListing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Dashboard: single MCP server (owner) */
export interface McpServer {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpServerTool {
  id: string;
  toolName: string | null;
  shortDescription: string | null;
  isEnabled: boolean;
  displayOrder: number;
  apiProxy: {
    id: string;
    name: string;
    description: string | null;
    pricingAsset: string;
    pricingAmount: string;
    category: string | null;
  };
}

export interface AvailableProxy {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricingAsset: string;
  pricingAmount: string;
  category: string | null;
  tags: string[] | null;
  isPublic: boolean;
  isOwn: boolean;
  createdAt: string;
}

export interface McpServerFormData {
  slug: string;
  name: string;
  description: string;
  isPublic: boolean;
}

/** Workflow template snippet returned with MCP workflow tools */
export interface WorkflowTemplateInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  inputSchema: { name: string; type: string }[];
}

/** Workflow link row on an MCP server (from API) */
export interface McpServerWorkflow {
  id: string;
  toolName: string | null;
  toolDescription: string | null;
  isEnabled: boolean;
  displayOrder: number;
  workflow?: WorkflowTemplateInfo | null;
  template?: WorkflowTemplateInfo;
}
