import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response
} from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { IncomingMessage, ServerResponse } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { isDatabaseConfigured } from "@agent-loom/database";
import { validateBearerToken, type AuthContext } from "./auth/oauth";
import { toolRegistry, type McpServerConfig } from "./tools/registry";
import { createToolsForServer, type ToolContext } from "./tools/proxy-tool";
import { createSoroswapSwapTool } from "./tools/soroswap-tool";
import { createSoroswapAggregatorSwapTool } from "./tools/soroswap-aggregator-tool";
import {
  createStellarBuyWithXlmTool,
  createStellarTrendingTokensTool
} from "./tools/stellar-agent-tools";
import { createWorkflowToolsForServer } from "./tools/workflow-tool";

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  auth: AuthContext;
  slug: string;
  config: McpServerConfig;
}

const sessions = new Map<string, McpSession>();

const SCOPES_SUPPORTED = [
  "stellar:payments",
  "stellar:soroswap",
  "mcp:tools",
  "workflow:token-approvals"
];

export function createApp(config: {
  webAppUrl: string;
  mcpPublicUrl: string | null;
}): Express {
  const app = express();
  app.set("trust proxy", true);

  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "mcp-session-id",
        "mcp-protocol-version"
      ],
      exposedHeaders: ["mcp-session-id"]
    })
  );

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "mcp-server",
      databaseConfigured: isDatabaseConfigured()
    });
  });

  const getPublicUrl = (req: express.Request): string => {
    if (config.mcpPublicUrl) {
      return config.mcpPublicUrl.replace(/\/$/, "");
    }
    const forwardedHost = req.get("x-forwarded-host");
    const forwardedProto = req.get("x-forwarded-proto") || req.protocol;
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }
    return `${req.protocol}://${req.get("host")}`;
  };

  const base = config.webAppUrl.replace(/\/$/, "");

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: SCOPES_SUPPORTED,
      token_endpoint_auth_methods_supported: ["client_secret_post"]
    });
  });

  app.get("/.well-known/oauth-authorization-server/*path", (req, res) => {
    const pathParts = req.params.path as unknown as string[];
    const fullPath = Array.isArray(pathParts) ? pathParts.join("/") : pathParts || "";
    const match = fullPath.match(/^mcp\/([^/]+)/);
    const slug = match ? match[1] : null;

    if (slug) {
      res.json({
        issuer: base,
        authorization_endpoint: `${base}/oauth/authorize?mcp_slug=${encodeURIComponent(slug)}`,
        token_endpoint: `${base}/api/oauth/token`,
        registration_endpoint: `${base}/api/oauth/register?mcp_slug=${encodeURIComponent(slug)}`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: SCOPES_SUPPORTED,
        token_endpoint_auth_methods_supported: ["client_secret_post"]
      });
    } else {
      res.json({
        issuer: base,
        authorization_endpoint: `${base}/oauth/authorize`,
        token_endpoint: `${base}/api/oauth/token`,
        registration_endpoint: `${base}/api/oauth/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: SCOPES_SUPPORTED,
        token_endpoint_auth_methods_supported: ["client_secret_post"]
      });
    }
  });

  app.get("/.well-known/oauth-protected-resource", (req, res) => {
    const mcpServerUrl = getPublicUrl(req);
    res.json({
      resource: mcpServerUrl,
      authorization_servers: [base],
      scopes_supported: SCOPES_SUPPORTED,
      bearer_methods_supported: ["header"]
    });
  });

  app.get("/mcp/:slug/.well-known/oauth-authorization-server", (req, res) => {
    const slugParam = req.params.slug;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize?mcp_slug=${encodeURIComponent(String(slug))}`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register?mcp_slug=${encodeURIComponent(String(slug))}`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: SCOPES_SUPPORTED,
      token_endpoint_auth_methods_supported: ["client_secret_post"]
    });
  });

  app.get("/mcp/:slug/.well-known/oauth-protected-resource", (req, res) => {
    const slugParam = req.params.slug;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
    const mcpServerUrl = getPublicUrl(req);
    res.json({
      resource: `${mcpServerUrl}/mcp/${slug}`,
      authorization_servers: [`${mcpServerUrl}/mcp/${slug}`],
      scopes_supported: SCOPES_SUPPORTED,
      bearer_methods_supported: ["header"]
    });
  });

  const mcpMiddleware = async (
    req: Request & { mcpSlug?: string; mcpAuth?: AuthContext },
    res: Response,
    next: NextFunction
  ) => {
    const slugParam = req.params.slug;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
    if (!slug) {
      res.status(400).json({ error: "Missing MCP server slug" });
      return;
    }
    req.mcpSlug = slug;

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        if (session.slug !== slug) {
          res.status(403).json({ error: "Session does not match requested slug" });
          return;
        }
        const refreshed = await validateBearerToken(req.headers.authorization);
        req.mcpAuth = refreshed ?? session.auth;
        next();
        return;
      }
    }

    const auth = await validateBearerToken(req.headers.authorization);
    if (!auth) {
      const publicUrl = getPublicUrl(req);
      const resourceMetadataUrl = `${publicUrl}/mcp/${slug}/.well-known/oauth-protected-resource`;
      res.setHeader(
        "WWW-Authenticate",
        `Bearer resource_metadata="${resourceMetadataUrl}"`
      );
      res.status(401).json({
        error: "unauthorized",
        error_description: "Valid OAuth token required",
        authorization_url: `${base}/oauth/authorize?mcp_slug=${encodeURIComponent(slug)}`
      });
      return;
    }

    if (auth.mcpSlug && auth.mcpSlug !== slug) {
      res.status(403).json({
        error: "forbidden",
        error_description: `Token is scoped to slug "${auth.mcpSlug}", not "${slug}"`
      });
      return;
    }

    req.mcpAuth = auth;
    next();
  };

  const createMcpServer = (
    serverConfig: McpServerConfig,
    auth: AuthContext
  ): McpServer => {
    const server = new McpServer(
      {
        name: `agent-loom-mcp-${serverConfig.slug}`,
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {
            listChanged: true
          }
        }
      }
    );

    const toolContext: ToolContext = {
      auth,
      webAppUrl: config.webAppUrl
    };

    const proxyTools = createToolsForServer(serverConfig.tools);
    const workflowToolDefs = createWorkflowToolsForServer(
      serverConfig.workflowTools
    );
    const soroswapTool = createSoroswapSwapTool();
    const soroswapAggregatorTool = createSoroswapAggregatorSwapTool();
    const stellarTrendingTool = createStellarTrendingTokensTool();
    const stellarBuyWithXlmTool = createStellarBuyWithXlmTool();

    for (const tool of [
      ...proxyTools,
      ...workflowToolDefs,
      soroswapTool,
      soroswapAggregatorTool,
      stellarTrendingTool,
      stellarBuyWithXlmTool
    ]) {
      const schemaShape =
        tool.inputSchema instanceof z.ZodObject
          ? (tool.inputSchema as z.ZodObject<z.ZodRawShape>).shape
          : {};

      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: schemaShape
        },
        async (args) => {
          const result = await tool.handler(
            args as Record<string, unknown>,
            toolContext
          );
          return {
            content: result.content,
            isError: result.isError
          };
        }
      );
    }

    return server;
  };

  app.post(
    "/mcp/:slug",
    mcpMiddleware,
    async (
      req: Request & { mcpSlug?: string; mcpAuth?: AuthContext },
      res: Response
    ) => {
      const slug = req.mcpSlug!;
      const auth = req.mcpAuth!;
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      try {
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          await session.transport.handleRequest(
            req as unknown as IncomingMessage,
            res as unknown as ServerResponse,
            req.body
          );
          return;
        }

        const serverConfig = await toolRegistry.loadToolsForSlug(slug);
        if (!serverConfig) {
          res.status(404).json({ error: "MCP server not found" });
          return;
        }

        const mcpServer = createMcpServer(serverConfig, auth);

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            sessions.set(newSessionId, {
              transport,
              server: mcpServer,
              auth,
              slug,
              config: serverConfig
            });
          }
        });

        await mcpServer.connect(transport);

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessions.delete(sid);
          }
        };

        await transport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse,
          req.body
        );
      } catch (e) {
        console.error("[MCP POST]", e);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    }
  );

  app.get(
    "/mcp/:slug",
    mcpMiddleware,
    async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !sessions.has(sessionId)) {
        res.status(400).json({ error: "Invalid or missing session ID" });
        return;
      }
      const session = sessions.get(sessionId)!;
      try {
        await session.transport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse
        );
      } catch (e) {
        console.error("[MCP GET]", e);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    }
  );

  app.delete(
    "/mcp/:slug",
    mcpMiddleware,
    async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !sessions.has(sessionId)) {
        res.status(400).json({ error: "Invalid or missing session ID" });
        return;
      }
      const session = sessions.get(sessionId)!;
      try {
        await session.transport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse
        );
        sessions.delete(sessionId);
      } catch (e) {
        console.error("[MCP DELETE]", e);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    }
  );

  return app;
}

export async function shutdown(): Promise<void> {
  for (const [, session] of sessions) {
    try {
      await session.server.close();
    } catch {
      // ignore
    }
  }
  sessions.clear();
}
