import { z } from "zod";
import type { McpToolDefinition, ToolContext } from "./proxy-tool";

const trendingSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("Max tokens to return (default 5).")
});

const buySchema = z.object({
  xlm_amount: z
    .string()
    .min(1)
    .describe('Human XLM to spend from the server hot wallet, e.g. "10" for 10 XLM.'),
  token_out_contract: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Soroban contract (C...) of the token to receive. Omit if using trend_rank."
    ),
  trend_rank: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "1-based rank from stellar_trending_tokens (e.g. 1 = top). Buys that token instead of token_out_contract."
    ),
  slippage_bps: z
    .number()
    .int()
    .min(0)
    .max(5000)
    .optional()
    .describe("Slippage in basis points (default 150 = 1.5%)."),
  use_aggregator: z
    .boolean()
    .optional()
    .describe(
      "If true, use Soroswap HTTP /quote + /build + /send (needs SOROSWAP_API_KEY). " +
        "If false or omitted, use direct AMM router (needs SAC XLM + router allowance)."
    ),
  protocols: z
    .array(z.string())
    .optional()
    .describe("When use_aggregator is true: protocols for /quote (optional)."),
  network: z.enum(["testnet", "public"]).optional()
});

/**
 * Discovery: ranked Soroban tokens. Uses STELLAR_TRENDING_API_URL when set; otherwise testnet curated fallback.
 */
export function createStellarTrendingTokensTool(): McpToolDefinition {
  return {
    name: "stellar_trending_tokens",
    description:
      "List top Stellar Soroban tokens (contract IDs) for trading. " +
      "There is no chain-wide trending API: configure STELLAR_TRENDING_API_URL on the Loom server for real rankings, " +
      "or use the testnet curated fallback for demos. " +
      "Pair with stellar_buy_with_xlm to swap hot-wallet SAC XLM into a listed token.",
    inputSchema: trendingSchema,

    async handler(
      args: Record<string, unknown>,
      context: ToolContext
    ): Promise<import("./proxy-tool").ToolResult> {
      const parsed = trendingSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true
        };
      }

      const limit = parsed.data.limit ?? 5;
      const base = context.webAppUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/api/stellar/trending?limit=${limit}`);
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
              text: `stellar_trending_tokens failed (${res.status}): ${JSON.stringify(json, null, 2)}`
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

/**
 * Executes Soroswap router swap SAC XLM → token using the workflow hot wallet (same as soroswap_swap).
 */
export function createStellarBuyWithXlmTool(): McpToolDefinition {
  return {
    name: "stellar_buy_with_xlm",
    description:
      "Buy a Soroban token by spending XLM (native SAC) from the Agent Loom **hot wallet**. " +
      "Default: direct Soroswap AMM router (needs SAC XLM + router allowance). " +
      "Set use_aggregator: true for Soroswap HTTP multi-protocol routing (needs SOROSWAP_API_KEY on the server). " +
      "Output goes to the authenticated user's Stellar address. " +
      "Use trend_rank: 1 with stellar_trending_tokens for “buy the top listed token”.",
    inputSchema: buySchema,

    async handler(
      args: Record<string, unknown>,
      context: ToolContext
    ): Promise<import("./proxy-tool").ToolResult> {
      const parsed = buySchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }],
          isError: true
        };
      }

      if (!parsed.data.token_out_contract && parsed.data.trend_rank === undefined) {
        return {
          content: [
            {
              type: "text",
              text:
                "Provide token_out_contract (C...) or trend_rank (e.g. 1 for top trending)."
            }
          ],
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
      const res = await fetch(`${base}/api/soroswap/buy-with-xlm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          xlm_amount: parsed.data.xlm_amount,
          token_out_contract: parsed.data.token_out_contract,
          trend_rank: parsed.data.trend_rank,
          slippage_bps: parsed.data.slippage_bps,
          use_aggregator: parsed.data.use_aggregator,
          protocols: parsed.data.protocols,
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
              text: `stellar_buy_with_xlm failed (${res.status}): ${JSON.stringify(json, null, 2)}`
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
