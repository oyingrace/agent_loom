import { z } from "zod";
import {
  runDryWorkflow,
  type VariableDefinition,
  type WorkflowDefinition
} from "@agent-loom/workflow";
import type {
  McpToolDefinition,
  ToolContext,
  ToolResult
} from "./proxy-tool";

export interface WorkflowToolConfig {
  id: string;
  name: string;
  description: string;
  workflowDefinition: WorkflowDefinition;
}

function buildInputSchema(
  variables: VariableDefinition[] | undefined
): z.ZodType {
  if (!variables?.length) {
    return z.object({});
  }

  const shape: Record<string, z.ZodType> = {};

  for (const v of variables) {
    let field: z.ZodType;
    switch (v.type) {
      case "string":
        field = z.string();
        break;
      case "number":
        field = z.number();
        break;
      case "boolean":
        field = z.boolean();
        break;
      case "account":
        field = z
          .string()
          .regex(/^[G][A-Z2-7]{55}$/, "Expected Stellar account strkey");
        break;
      default:
        field = z.unknown();
    }

    if (v.description) {
      field = field.describe(v.description);
    }
    if (!v.required) {
      field = field.optional();
      if (v.default !== undefined) {
        field = field.default(v.default as never);
      }
    }

    shape[v.name] = field;
  }

  return z.object(shape);
}

function createWorkflowTool(cfg: WorkflowToolConfig): McpToolDefinition {
  const vars = cfg.workflowDefinition.inputVariables;
  const inputSchema = buildInputSchema(vars);

  return {
    name: cfg.name,
    description: cfg.description,
    inputSchema,

    async handler(
      args: Record<string, unknown>,
      ctx: ToolContext
    ): Promise<ToolResult> {
      try {
        const parsed = inputSchema.safeParse(args);
        if (!parsed.success) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid arguments: ${parsed.error.message}`
              }
            ],
            isError: true
          };
        }

        const network =
          process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";

        const result = runDryWorkflow(
          cfg.workflowDefinition,
          parsed.data as Record<string, unknown>,
          ctx.auth.user.accountAddress,
          network
        );

        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Workflow dry-run failed: ${result.error ?? "unknown"}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { output: result.output, steps: result.steps },
                null,
                2
              )
            }
          ]
        };
      } catch (e) {
        console.error("[WorkflowTool]", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  };
}

export function createWorkflowToolsForServer(
  configs: WorkflowToolConfig[]
): McpToolDefinition[] {
  return configs.map((c) => createWorkflowTool(c));
}
