import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();

const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountAddress: varchar("account_address", { length: 128 }).notNull().unique(),
    displayName: varchar("display_name", { length: 120 }),
    createdAt,
    updatedAt
  },
  (table) => [index("users_account_address_idx").on(table.accountAddress)]
);

export const apiProxies = pgTable(
  "api_proxies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    targetUrl: text("target_url").notNull(),
    encryptedHeaders: text("encrypted_headers"),
    inputSchema: jsonb("input_schema").$type<Record<string, unknown>>(),
    outputSchema: jsonb("output_schema").$type<Record<string, unknown>>(),
    pricingAsset: varchar("pricing_asset", { length: 128 }).notNull(),
    pricingAmount: varchar("pricing_amount", { length: 64 }).notNull(),
    payoutAddress: varchar("payout_address", { length: 128 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(true),
    description: text("description"),
    category: varchar("category", { length: 64 }),
    tags: jsonb("tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    httpMethod: varchar("http_method", { length: 16 }).notNull().default("GET"),
    variablesSchema: jsonb("variables_schema")
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    requestBodyTemplate: text("request_body_template"),
    queryParamsTemplate: text("query_params_template"),
    contentType: varchar("content_type", { length: 128 }).notNull().default("application/json"),
    exampleResponse: text("example_response"),
    createdAt,
    updatedAt
  },
  (table) => [index("api_proxies_owner_user_idx").on(table.ownerUserId)]
);

export const requestLogs = pgTable(
  "request_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proxyId: uuid("proxy_id")
      .notNull()
      .references(() => apiProxies.id, { onDelete: "cascade" }),
    statusCode: integer("status_code").notNull(),
    statusText: varchar("status_text", { length: 255 }),
    requestPayload: jsonb("request_payload").$type<Record<string, unknown>>(),
    responsePayload: jsonb("response_payload").$type<Record<string, unknown>>(),
    paymentReference: varchar("payment_reference", { length: 200 }),
    createdAt
  },
  (table) => [index("request_logs_proxy_id_idx").on(table.proxyId)]
);

export const sessionKeys = pgTable(
  "session_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionPublicKey: text("session_public_key").notNull(),
    encryptedSessionSecret: text("encrypted_session_secret").notNull(),
    scopeConfig: jsonb("scope_config").$type<Record<string, unknown>>().notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt
  },
  (table) => [index("session_keys_user_id_idx").on(table.userId)]
);

export const oauthClients = pgTable(
  "oauth_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: varchar("client_id", { length: 128 }).notNull().unique(),
    clientSecretHash: text("client_secret_hash"),
    allowedScopes: jsonb("allowed_scopes").$type<string[]>().notNull(),
    redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
    grantTypes: jsonb("grant_types").$type<string[]>().notNull(),
    tokenEndpointAuthMethod: varchar("token_endpoint_auth_method", { length: 64 })
      .notNull()
      .default("client_secret_post"),
    mcpSlug: varchar("mcp_slug", { length: 80 }),
    createdAt,
    updatedAt
  },
  (table) => [index("oauth_clients_owner_user_idx").on(table.ownerUserId)]
);

export const oauthAuthCodes = pgTable(
  "oauth_auth_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: varchar("client_id", { length: 128 })
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionKeyId: uuid("session_key_id").references(() => sessionKeys.id, {
      onDelete: "set null"
    }),
    code: varchar("code", { length: 140 }).notNull().unique(),
    codeChallenge: varchar("code_challenge", { length: 255 }),
    codeChallengeMethod: varchar("code_challenge_method", { length: 20 }),
    scope: text("scope"),
    redirectUri: text("redirect_uri"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt
  },
  (table) => [index("oauth_auth_codes_client_id_idx").on(table.clientId)]
);

export const oauthAccessTokens = pgTable(
  "oauth_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: varchar("client_id", { length: 128 })
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionKeyId: uuid("session_key_id").references(() => sessionKeys.id, {
      onDelete: "set null"
    }),
    tokenHash: text("token_hash").notNull().unique(),
    scope: text("scope"),
    mcpSlug: varchar("mcp_slug", { length: 80 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt
  },
  (table) => [index("oauth_access_tokens_client_id_idx").on(table.clientId)]
);

export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt,
    updatedAt
  },
  (table) => [index("mcp_servers_owner_user_idx").on(table.ownerUserId)]
);

export const mcpServerTools = pgTable(
  "mcp_server_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mcpServerId: uuid("mcp_server_id")
      .notNull()
      .references(() => mcpServers.id, { onDelete: "cascade" }),
    proxyId: uuid("proxy_id")
      .notNull()
      .references(() => apiProxies.id, { onDelete: "cascade" }),
    toolName: varchar("tool_name", { length: 120 }).notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt
  },
  (table) => [index("mcp_server_tools_server_id_idx").on(table.mcpServerId)]
);

export const workflowTemplates = pgTable(
  "workflow_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    workflowDefinition: jsonb("workflow_definition")
      .$type<Record<string, unknown>>()
      .notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt,
    updatedAt
  },
  (table) => [index("workflow_templates_owner_user_idx").on(table.ownerUserId)]
);

export const mcpServerWorkflows = pgTable(
  "mcp_server_workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mcpServerId: uuid("mcp_server_id")
      .notNull()
      .references(() => mcpServers.id, { onDelete: "cascade" }),
    workflowTemplateId: uuid("workflow_template_id")
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: "cascade" }),
    toolName: varchar("tool_name", { length: 120 }).notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt
  },
  (table) => [index("mcp_server_workflows_server_id_idx").on(table.mcpServerId)]
);

export const migrationMetadata = pgTable("migration_metadata", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt
});

export const tables = {
  users,
  apiProxies,
  requestLogs,
  sessionKeys,
  oauthClients,
  oauthAuthCodes,
  oauthAccessTokens,
  mcpServers,
  mcpServerTools,
  workflowTemplates,
  mcpServerWorkflows,
  migrationMetadata
};

export const nowSql = sql`now()`;
