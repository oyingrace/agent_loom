import { z } from "zod";
import type { McpToolDefinition, ToolContext } from "./proxy-tool";

const inputSchema = z.object({
  asset_in: z
    .string()
    .min(1)
    .describe("Soroban contract (C...) of the token spent (e.g. native XLM SAC)."),
  asset_out: z
    .string()
    .min(1)
    .describe("Soroban contract (C...) of the token received."),
  amount_in: z
    .string()
    .min(1)
    .describe("Input amount in smallest units (integer string)."),
  trade_type: z.enum(["EXACT_IN", "EXACT_OUT"]).optional(),
  protocols: z
    .array(z.string())
    .optional()
    .describe("Aggregator protocols (default soroswap, phoenix, aqua)."),
  slippage_bps: z
    .number()
    .int()
    .min(0)
    .max(5000)
    .optional()
    .describe("Optional slippage passed to /quote (basis points)."),
  recipient: z
    .string()
    .optional()
    .describe("Optional G... receiving output; defaults to OAuth user Stellar address."),
  network: z.enum(["testnet", "public"]).optional()
});

/**
 * Soroswap **HTTP aggregator** (quote → build → hot-wallet sign → /send).
 * Requires SOROSWAP_API_KEY and WORKFLOW_HOT_WALLET_SECRET on the web app.
 */
export function createSoroswapAggregatorSwapTool(): McpToolDefinition {
  return {
    name: "soroswap_aggregator_swap",
    description:
      "Swap via Soroswap's HTTP API (multi-protocol routing: Soroswap, Phoenix, Aqua, etc.). " +
      "Server uses SOROSWAP_API_KEY for /quote and /quote/build, signs with the workflow hot wallet, " +
      "then POSTs to /send. " +
      "Unlike soroswap_swap (direct router), this does not require a precomputed hop path. " +
      "Hot wallet must be funded and able to sign the built transaction.",
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
                "Send Authorization: Bearer on each MCP request."
            }
          ],
          isError: true
        };
      }

      const base = context.webAppUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/api/soroswap/aggregator-swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          asset_in: parsed.data.asset_in,
          asset_out: parsed.data.asset_out,
          amount_in: parsed.data.amount_in,
          recipient: parsed.data.recipient,
          trade_type: parsed.data.trade_type,
          protocols: parsed.data.protocols,
          slippage_bps: parsed.data.slippage_bps,
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
              text: `soroswap_aggregator_swap failed (${res.status}): ${JSON.stringify(json, null, 2)}`
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
