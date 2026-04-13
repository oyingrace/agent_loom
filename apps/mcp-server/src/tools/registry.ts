import { and, asc, eq } from "drizzle-orm";
import type { WorkflowDefinition } from "@agent-loom/workflow";
import {
  apiProxies,
  mcpServers,
  mcpServerTools,
  mcpServerWorkflows,
  workflowTemplates
} from "@agent-loom/database";
import { getDb } from "../db";

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  proxyId: string;
}

export interface WorkflowToolConfig {
  id: string;
  name: string;
  description: string;
  workflowDefinition: WorkflowDefinition;
}

export interface McpServerConfig {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  tools: ToolConfig[];
  workflowTools: WorkflowToolConfig[];
}

const cache = new Map<string, { config: McpServerConfig; expires: number }>();
const TTL_MS = 60_000;

export class ToolRegistry {
  async loadToolsForSlug(slug: string): Promise<McpServerConfig | null> {
    const now = Date.now();
    const hit = cache.get(slug);
    if (hit && hit.expires > now) {
      return hit.config;
    }

    const db = getDb();
    const serverRows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.slug, slug))
      .limit(1);
    const server = serverRows[0];
    if (!server) {
      return null;
    }

    const proxyRows = await db
      .select({
        tool: mcpServerTools,
        proxy: apiProxies
      })
      .from(mcpServerTools)
      .innerJoin(apiProxies, eq(mcpServerTools.proxyId, apiProxies.id))
      .where(
        and(
          eq(mcpServerTools.mcpServerId, server.id),
          eq(mcpServerTools.enabled, true),
          eq(apiProxies.isActive, true)
        )
      )
      .orderBy(asc(mcpServerTools.sortOrder));

    const tools: ToolConfig[] = [];
    for (const row of proxyRows) {
      tools.push({
        id: row.tool.id,
        name: row.tool.toolName,
        description: row.tool.description ?? row.proxy.name,
        proxyId: row.proxy.id
      });
    }

    const wfRows = await db
      .select({
        link: mcpServerWorkflows,
        template: workflowTemplates
      })
      .from(mcpServerWorkflows)
      .innerJoin(
        workflowTemplates,
        eq(mcpServerWorkflows.workflowTemplateId, workflowTemplates.id)
      )
      .where(
        and(
          eq(mcpServerWorkflows.mcpServerId, server.id),
          eq(mcpServerWorkflows.enabled, true)
        )
      )
      .orderBy(asc(mcpServerWorkflows.sortOrder));

    const workflowTools: WorkflowToolConfig[] = [];
    for (const row of wfRows) {
      workflowTools.push({
        id: row.link.id,
        name: row.link.toolName,
        description:
          row.link.description ?? row.template.name ?? "Workflow tool",
        workflowDefinition: row.template.workflowDefinition as unknown as WorkflowDefinition
      });
    }

    const config: McpServerConfig = {
      id: server.id,
      slug: server.slug,
      name: server.name,
      description: server.description ?? null,
      isPublic: server.isPublic,
      tools,
      workflowTools
    };

    cache.set(slug, { config, expires: now + TTL_MS });
    return config;
  }

  invalidate(slug: string): void {
    cache.delete(slug);
  }
}

export const toolRegistry = new ToolRegistry();
