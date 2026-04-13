import { z } from "zod";
import { eq } from "drizzle-orm";
import { apiProxies } from "@agent-loom/database";
import { getDb } from "../db";
import type { AuthContext } from "../auth/oauth";
import type { ToolConfig } from "./registry";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface ToolContext {
  auth: AuthContext;
  webAppUrl: string;
}

const legacyPaymentSchema = z.object({
  txHash: z.string().min(1),
  paymentNonce: z.string().min(1)
});

/**
 * Proxy tools accept either:
 * - `x402_header`: base64 JSON PaymentPayload (Stellar x402 / facilitator flow), or
 * - `x_payment`: legacy Horizon memo proof `{ txHash, paymentNonce }`.
 */
function buildInputSchema() {
  return z
    .object({
      x402_header: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Stellar x402: base64-encoded PaymentPayload for X-PAYMENT. After a 402, read `accepts[0]` (PaymentRequirements), sign with your wallet, then retry with this header. See https://developers.stellar.org/docs/build/agentic-payments/x402"
        ),
      x_payment: legacyPaymentSchema
        .optional()
        .describe(
          "Legacy: after paying the TEXT memo on Horizon, pass tx hash + nonce (JSON body to X-PAYMENT)."
        )
    })
    .passthrough();
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  handler: (
    args: Record<string, unknown>,
    context: ToolContext
  ) => Promise<ToolResult>;
}

export function createProxyTool(toolConfig: ToolConfig): McpToolDefinition {
  const inputSchema = buildInputSchema();

  return {
    name: toolConfig.name,
    description: toolConfig.description,
    inputSchema,

    async handler(
      args: Record<string, unknown>,
      context: ToolContext
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

        if (parsed.data.x402_header && parsed.data.x_payment) {
          return {
            content: [
              {
                type: "text",
                text: "Use only one of x402_header or x_payment."
              }
            ],
            isError: true
          };
        }

        const rest = { ...parsed.data } as Record<string, unknown>;
        delete rest.x_payment;
        delete rest.x402_header;

        const db = getDb();
        const proxyRows = await db
          .select()
          .from(apiProxies)
          .where(eq(apiProxies.id, toolConfig.proxyId))
          .limit(1);
        const proxy = proxyRows[0];
        if (!proxy) {
          return {
            content: [{ type: "text", text: "Error: Proxy not found" }],
            isError: true
          };
        }

        const proxyUrl = `${context.webAppUrl.replace(/\/$/, "")}/api/proxy/${proxy.id}`;

        const headers: Record<string, string> = {
          Accept: "application/json"
        };

        const x402Header = parsed.data.x402_header?.trim();
        const legacy = parsed.data.x_payment;
        if (x402Header) {
          headers["X-PAYMENT"] = x402Header;
        } else if (legacy) {
          headers["X-PAYMENT"] = JSON.stringify({
            txHash: legacy.txHash,
            paymentNonce: legacy.paymentNonce
          });
        }

        const hasBody = Object.keys(rest).length > 0;
        const method = hasBody ? "POST" : "GET";

        if (hasBody) {
          headers["Content-Type"] = "application/json";
        }

        const requestInit: RequestInit = {
          method,
          headers
        };

        if (hasBody) {
          requestInit.body = JSON.stringify(rest);
        }

        const response = await fetch(proxyUrl, requestInit);

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `API returned error (${response.status})`;
          try {
            const errorJson = JSON.parse(errorText) as { error?: string };
            if (errorJson.error) {
              errorMessage = errorJson.error;
            }
          } catch {
            if (errorText) {
              errorMessage = errorText.slice(0, 500);
            }
          }
          if (response.status === 402) {
            let detail = errorMessage;
            try {
              const body = JSON.parse(errorText) as Record<string, unknown>;
              detail = JSON.stringify(body, null, 2);
            } catch {
              if (errorText) detail = errorText.slice(0, 4000);
            }
            return {
              content: [
                {
                  type: "text",
                  text:
                    `HTTP 402 Payment Required. ` +
                    `First call: omit x402_header and x_payment. ` +
                    `Retry: send x402_header (base64 PaymentPayload from signed tx; use accepts[0] as PaymentRequirements) or x_payment for legacy memo flow.\n\n` +
                    detail
                }
              ],
              isError: true
            };
          }
          return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true
          };
        }

        const responseText = await response.text();
        try {
          const json = JSON.parse(responseText) as unknown;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(json, null, 2)
              }
            ]
          };
        } catch {
          return {
            content: [{ type: "text", text: responseText }]
          };
        }
      } catch (error) {
        console.error("[ProxyTool]", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error invoking tool: ${message}` }],
          isError: true
        };
      }
    }
  };
}

export function createToolsForServer(tools: ToolConfig[]): McpToolDefinition[] {
  return tools.map((t) => createProxyTool(t));
}
