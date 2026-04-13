/**
 * Phase 6 MCP smoke test runner.
 *
 * What it does:
 * 1) Creates an authenticated web session using wallet signature auth (Phase 4 primitives).
 * 2) Seeds Postgres rows for:
 *    - `mcp_servers`
 *    - `api_proxies`
 *    - `mcp_server_tools` (proxy tools)
 *    - `workflow_templates`
 *    - `mcp_server_workflows` (workflow tools)
 * 3) Completes OAuth authorization code + PKCE to obtain a bearer token.
 * 4) Connects to the MCP server via `@modelcontextprotocol/sdk` (Streamable HTTP transport).
 * 5) Verifies:
 *    - tool discovery works (`client.listTools()`)
 *    - workflow tool invocation succeeds (dry-run)
 *    - proxy tool invocation returns the expected payment-related error (proves X-PAYMENT parsing)
 *
 * Usage (from repo root):
 *   pnpm tsx tooling/phase6-mcp-smoke.ts
 *
 * Required env vars:
 *   - DATABASE_URL
 *   - APP_SESSION_SECRET or SESSION_SECRET (for iron-session)
 *   - WEB_APP_URL (optional; default http://localhost:3000)
 *   - MCP_SERVER_URL (optional; default http://localhost:3001)
 *
 * Notes:
 * - This expects Postgres + Redis are already up, and the web + mcp-server processes are running.
 */

import { randomUUID, createHash, randomBytes } from "crypto";
import pg from "pg";
import { Keypair } from "@stellar/stellar-base";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { buildAuthMessage } from "../apps/web/lib/stellar/authMessage";

type CookieJar = {
  cookieHeader?: string;
};

function sha256Base64Url(input: Buffer): string {
  return createHash("sha256").update(input).digest("base64url");
}

async function updateCookieJarFromResponse(res: Response, jar: CookieJar) {
  const getSetCookies = (res.headers as any).getSetCookie as
    | undefined
    | (() => string[]);
  const setCookies = getSetCookies?.() ?? [];

  if (!setCookies.length) {
    // Some runtimes don't expose getSetCookie; try a single header.
    const raw = res.headers.get("set-cookie");
    if (raw) {
      jar.cookieHeader = raw.split(";")[0];
    }
    return;
  }

  // Only keep name=value pairs (strip attributes).
  jar.cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function fetchWithCookie(
  url: string,
  init: RequestInit,
  jar: CookieJar
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (jar.cookieHeader) {
    headers.set("Cookie", jar.cookieHeader);
  }

  const res = await fetch(url, { ...init, headers });
  await updateCookieJarFromResponse(res, jar);
  return res;
}

function parseCodeFromRedirect(redirectUrl: string): string {
  const u = new URL(redirectUrl);
  const code = u.searchParams.get("code");
  if (!code) throw new Error(`Missing code query param in: ${redirectUrl}`);
  return code;
}

async function main() {
  const runId = randomUUID().slice(0, 8);

  const webAppUrl = (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const mcpServerUrl = (process.env.MCP_SERVER_URL ?? "http://localhost:3001").replace(
    /\/$/,
    ""
  );
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  // Base deterministic names (we still append runId for uniqueness).
  const baseMcpSlug = process.env.MCP_SLUG ?? "smoke-mcp";
  const baseProxySlug = process.env.PROXY_SLUG ?? "smoke-proxy";
  const baseProxyToolName = process.env.PROXY_TOOL_NAME ?? "smoke_proxy_tool";
  const baseWorkflowToolName =
    process.env.WORKFLOW_TOOL_NAME ?? "smoke_workflow_tool";
  const redirectUri = process.env.OAUTH_REDIRECT_URI ?? "http://localhost:9999/callback";

  const mcpSlug = `${baseMcpSlug}-${runId}`;
  const proxySlug = `${baseProxySlug}-${runId}`;
  const proxyToolName = `${baseProxyToolName}-${runId}`;
  const workflowToolName = `${baseWorkflowToolName}-${runId}`;
  const targetUrl = process.env.PROXY_TARGET_URL ?? "https://httpbin.org/get";

  console.log("Phase 6 smoke run config:");
  console.log({ webAppUrl, mcpServerUrl, databaseUrl, mcpSlug, proxySlug, proxyToolName, workflowToolName });

  // 1) Create signed-in web session (Phase 4 auth message).
  const cookieJar: CookieJar = {};
  const kp = Keypair.random();
  const accountAddress = kp.publicKey(); // `G...`

  const nonceRes = await fetch(`${webAppUrl}/api/auth/nonce`, {
    method: "GET"
  });
  if (!nonceRes.ok) {
    throw new Error(`GET /api/auth/nonce failed: ${nonceRes.status} ${nonceRes.statusText}`);
  }
  const nonceBody = (await nonceRes.json()) as {
    nonce: string;
    domain: string;
    messageVersion?: string;
  };

  const message = buildAuthMessage({
    nonce: nonceBody.nonce,
    accountAddress,
    domain: nonceBody.domain
  });
  const sigBuf = kp.sign(Buffer.from(message, "utf8"));
  const signature = sigBuf.toString("base64");

  const sessionRes = await fetchWithCookie(
    `${webAppUrl}/api/auth/session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountAddress,
        nonce: nonceBody.nonce,
        signature
      })
    },
    cookieJar
  );

  if (!sessionRes.ok) {
    const txt = await sessionRes.text().catch(() => "");
    throw new Error(`POST /api/auth/session failed: ${sessionRes.status} ${txt}`);
  }
  const sessionBody = (await sessionRes.json()) as {
    user: { id: string; accountAddress: string };
  };
  const userId = sessionBody.user.id;
  console.log("Authenticated user:", { userId, accountAddress });

  // 2) Seed Postgres.
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Clean up leftovers from previous runs (best-effort).
    await client.query(
      `
      DELETE FROM mcp_server_tools
      USING mcp_servers
      WHERE mcp_server_tools.mcp_server_id = mcp_servers.id
        AND mcp_servers.slug = $1;
      `,
      [mcpSlug]
    );
    await client.query(
      `
      DELETE FROM mcp_server_workflows
      USING mcp_servers
      WHERE mcp_server_workflows.mcp_server_id = mcp_servers.id
        AND mcp_servers.slug = $1;
      `,
      [mcpSlug]
    );
    await client.query(`DELETE FROM mcp_servers WHERE slug = $1;`, [mcpSlug]);
    await client.query(`DELETE FROM api_proxies WHERE slug = $1;`, [proxySlug]);
    await client.query(
      `
      DELETE FROM workflow_templates
      WHERE owner_user_id = $1
        AND name = $2;
      `,
      [userId, `smoke-workflow-template-${runId}`]
    );

    const mcpServerIdRes = await client.query(
      `
      INSERT INTO mcp_servers (owner_user_id, slug, name, description, is_public)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
      `,
      [userId, mcpSlug, `Smoke MCP ${runId}`, "Phase 6 smoke test server", true]
    );
    const mcpServerId = mcpServerIdRes.rows[0].id as string;

    const apiProxyIdRes = await client.query(
      `
      INSERT INTO api_proxies (
        owner_user_id, slug, name, target_url,
        encrypted_headers, input_schema, output_schema,
        pricing_asset, pricing_amount, payout_address,
        is_active
      )
      VALUES ($1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11
      )
      RETURNING id;
      `,
      [
        userId,
        proxySlug,
        `Smoke Proxy ${runId}`,
        targetUrl,
        null,
        null,
        null,
        "native",
        "1",
        accountAddress,
        true
      ]
    );
    const proxyId = apiProxyIdRes.rows[0].id as string;

    await client.query(
      `
      INSERT INTO mcp_server_tools (
        mcp_server_id, proxy_id, tool_name, description, enabled, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6);
      `,
      [mcpServerId, proxyId, proxyToolName, "Smoke proxy tool for Phase 6", true, 0]
    );

    const workflowTemplateIdRes = await client.query(
      `
      INSERT INTO workflow_templates (
        owner_user_id, name, description, workflow_definition, is_public
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
      `,
      [
        userId,
        `smoke-workflow-template-${runId}`,
        "Smoke workflow template that dry-runs a proxy http step",
        JSON.stringify({
          version: "1.0",
          inputVariables: [],
          steps: [
            {
              id: `step_http_${runId}`,
              name: "HTTP (dry-run)",
              type: "http",
              http: {
                proxyId,
                url: "https://httpbin.org/get",
                method: "GET",
                bodyMapping: {}
              },
              outputAs: "httpOut"
            }
          ],
          outputMapping: {
            message: "$.steps.httpOut.output._message",
            proxyId: "$.steps.httpOut.output.proxyId",
            url: "$.steps.httpOut.output.url"
          }
        }),
        false
      ]
    );
    const workflowTemplateId = workflowTemplateIdRes.rows[0].id as string;

    await client.query(
      `
      INSERT INTO mcp_server_workflows (
        mcp_server_id, workflow_template_id, tool_name, description, enabled, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6);
      `,
      [
        mcpServerId,
        workflowTemplateId,
        workflowToolName,
        "Smoke workflow tool for Phase 6 (dry-run)",
        true,
        0
      ]
    );

    console.log("Seeded DB rows:", { mcpServerId, proxyId, workflowTemplateId });

    // 3) OAuth auth code flow: use the authenticated browser session created above.
    const requestedScopes = ["mcp:tools", "stellar:payments", "workflow:token-approvals"];
    const pkceVerifier = randomBytes(32).toString("base64url");
    const pkceChallenge = sha256Base64Url(Buffer.from(pkceVerifier, "utf8"));

    const registerRes = await fetchWithCookie(
      `${webAppUrl}/api/oauth/register?mcp_slug=${encodeURIComponent(mcpSlug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: [redirectUri],
          client_name: `smoke-client-${runId}`,
          client_uri: redirectUri,
          scope: requestedScopes.join(" ")
        })
      },
      cookieJar
    );
    const registerBody = (await registerRes.json()) as {
      client_id: string;
      client_secret: string;
    };
    if (!registerRes.ok) {
      throw new Error(
        `POST /api/oauth/register failed: ${registerRes.status} ${JSON.stringify(registerBody)}`
      );
    }

    const clientId = registerBody.client_id;
    const clientSecret = registerBody.client_secret;
    console.log("Registered OAuth client:", { clientId });

    const authorizeRes = await fetchWithCookie(
      `${webAppUrl}/api/oauth/authorize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: pkceChallenge,
          approved_scopes: requestedScopes,
          state: `smoke-${runId}`,
          mcp_slug: mcpSlug
        })
      },
      cookieJar
    );
    const authorizeBody = (await authorizeRes.json()) as { redirect_uri: string };
    if (!authorizeRes.ok) {
      throw new Error(
        `POST /api/oauth/authorize failed: ${authorizeRes.status} ${JSON.stringify(authorizeBody)}`
      );
    }

    const code = parseCodeFromRedirect(authorizeBody.redirect_uri);

    const tokenRes = await fetch(
      `${webAppUrl}/api/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
          code_verifier: pkceVerifier
        })
      }
    );
    const tokenBody = (await tokenRes.json()) as {
      access_token: string;
    };
    if (!tokenRes.ok) {
      throw new Error(
        `POST /api/oauth/token failed: ${tokenRes.status} ${JSON.stringify(tokenBody)}`
      );
    }

    const accessToken = tokenBody.access_token;
    console.log("Obtained OAuth access token");

    // 4) MCP connect + listTools.
    const transportUrl = `${mcpServerUrl}/mcp/${encodeURIComponent(mcpSlug)}`;

    const clientMcp = new Client(
      { name: "phase6-smoke-client", version: "1.0.0" },
      { capabilities: {} }
    );
    const transport = new StreamableHTTPClientTransport(new URL(transportUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    await clientMcp.connect(transport);
    const toolsResult = await clientMcp.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);

    if (!toolNames.includes(workflowToolName)) {
      throw new Error(`Workflow tool not found in MCP tools: ${workflowToolName}`);
    }
    if (!toolNames.includes(proxyToolName)) {
      throw new Error(`Proxy tool not found in MCP tools: ${proxyToolName}`);
    }

    console.log("MCP tools discovered:", { workflowToolName, proxyToolName });

    // 5) Invoke workflow tool (dry-run).
    const workflowRes = await clientMcp.callTool(workflowToolName, {});
    console.log("Workflow tool result:", workflowRes);

    // 6) Invoke proxy tool with intentionally invalid payment nonce.
    // Expectation: proxy runtime should parse X-PAYMENT and reject with
    // "Invalid or expired payment nonce" (distinct from missing payment => payment_required).
    const proxyRes = await clientMcp.callTool(proxyToolName, {
      x_payment: { txHash: "smoke-txhash", paymentNonce: "smoke-nonce" }
    });
    console.log("Proxy tool result:", proxyRes);

    const serialized = JSON.stringify(proxyRes);
    if (!serialized.includes("Invalid or expired payment nonce")) {
      throw new Error(
        "Proxy tool invocation did not return the expected X-PAYMENT parsing error. Expected error string not found."
      );
    }

    console.log("Phase 6 MCP smoke test: PASS");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

