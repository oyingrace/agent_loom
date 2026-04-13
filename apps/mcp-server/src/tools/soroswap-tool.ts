import { z } from "zod";
import type { McpToolDefinition, ToolContext } from "./proxy-tool";

const inputSchema = z.object({
  amount_in: z
    .string()
    .min(1)
    .describe("Input amount in smallest token units (integer string)."),
  amount_out_min: z
    .string()
    .min(1)
    .describe("Minimum output amount (integer string) for slippage protection."),
  path: z
    .array(z.string().min(1))
    .min(2)
    .describe(
      "Soroban token contract addresses (C...) in order: first is token in, last is token out."
    ),
  recipient: z
    .string()
    .optional()
    .describe(
      "Optional G... account receiving output; defaults to the OAuth user's Stellar address."
    ),
  deadline_unix: z
    .number()
    .optional()
    .describe("Optional Unix timestamp (seconds) before which the swap must execute."),
  network: z
    .enum(["testnet", "public"])
    .optional()
    .describe("Defaults from server STELLAR_NETWORK.")
});

/**
 * Soroswap AMM **direct** router integration (`swap_exact_tokens_for_tokens`).
 * @see https://docs.soroswap.finance/
 */
export function createSoroswapSwapTool(): McpToolDefinition {
  return {
    name: "soroswap_swap",
    description:
      "Swap Soroban tokens via Soroswap AMM router (swap_exact_tokens_for_tokens). " +
      "The Agent Loom server hot wallet must hold the input token and have approved the Soroswap router. " +
      "Testnet router defaults: docs + https://github.com/soroswap/core/blob/main/public/testnet.contracts.json",
    inputSchema,

    async handler(
      args: Record<string, unknown>,
      context: ToolContext
    ): Promise<import("./proxy-tool").ToolResult> {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true
        };
      }

      const token = context.auth.bearerToken;
      if (!token) {
        return {
          content: [
            {
              type: "text",
              text:
                "OAuth bearer token not available on this MCP session. " +
                "Send Authorization: Bearer on each MCP request, or reconnect so the token is captured."
            }
          ],
          isError: true
        };
      }

      const base = context.webAppUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/api/soroswap/swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount_in: parsed.data.amount_in,
          amount_out_min: parsed.data.amount_out_min,
          path: parsed.data.path,
          recipient: parsed.data.recipient,
          deadline_unix: parsed.data.deadline_unix,
          network: parsed.data.network
        })
      });

      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { raw: text.slice(0, 2000) };
      }

      if (!res.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Soroswap swap failed (${res.status}): ${JSON.stringify(json, null, 2)}`
            }
          ],
          isError: true
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(json, null, 2) }]
      };
    }
  };
}
