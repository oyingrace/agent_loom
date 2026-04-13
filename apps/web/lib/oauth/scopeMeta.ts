/**
 * OAuth scope metadata for consent UI (Agent Fabric–style cards).
 * Keep in sync with MCP `SCOPES_SUPPORTED` and client `allowedScopes`.
 */
export type OAuthScopeMeta = {
  name: string;
  description: string;
  /** Display category */
  type: string;
  /** Whether server-side limits apply (informational for Stellar) */
  budgetEnforceable: boolean;
};

export const OAUTH_SCOPE_META: Record<string, OAuthScopeMeta> = {
  "mcp:tools": {
    name: "MCP tools",
    description:
      "Invoke tools exposed by your configured MCP servers (workflows, proxies, Soroswap when enabled).",
    type: "mcp",
    budgetEnforceable: true
  },
  "stellar:payments": {
    name: "Stellar payments",
    description: "Authorize Stellar-asset payments for paid tools and x402 flows.",
    type: "payments",
    budgetEnforceable: true
  },
  "stellar:soroswap": {
    name: "Soroswap swaps",
    description:
      "Allow server-side swaps via Soroswap using the workflow hot wallet (you receive output at your Stellar address unless another recipient is specified). Covers soroswap_swap, soroswap_aggregator_swap, stellar_buy_with_xlm, and related APIs.",
    type: "defi",
    budgetEnforceable: false
  },
  "workflow:token-approvals": {
    name: "Workflow token approvals",
    description: "Approve specific Stellar assets for automated workflow actions.",
    type: "workflow",
    budgetEnforceable: false
  }
};

export function scopeDetailsForIds(scopeIds: string[]) {
  return scopeIds.map((id) => {
    const meta = OAUTH_SCOPE_META[id];
    if (meta) {
      return { id, ...meta };
    }
    return {
      id,
      name: id,
      description: "Additional permission requested by the client.",
      type: "unknown",
      budgetEnforceable: false
    };
  });
}
