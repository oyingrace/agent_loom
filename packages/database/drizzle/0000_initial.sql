CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_address varchar(128) NOT NULL UNIQUE,
  display_name varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_proxies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug varchar(100) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  target_url text NOT NULL,
  encrypted_headers text,
  input_schema jsonb,
  output_schema jsonb,
  pricing_asset varchar(128) NOT NULL,
  pricing_amount varchar(64) NOT NULL,
  payout_address varchar(128) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_proxies_owner_user_idx ON api_proxies(owner_user_id);

CREATE TABLE IF NOT EXISTS request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_id uuid NOT NULL REFERENCES api_proxies(id) ON DELETE CASCADE,
  status_code integer NOT NULL,
  status_text varchar(255),
  request_payload jsonb,
  response_payload jsonb,
  payment_reference varchar(200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_logs_proxy_id_idx ON request_logs(proxy_id);

CREATE TABLE IF NOT EXISTS session_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_public_key text NOT NULL,
  encrypted_session_secret text NOT NULL,
  scope_config jsonb NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_keys_user_id_idx ON session_keys(user_id);

CREATE TABLE IF NOT EXISTS oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id varchar(128) NOT NULL UNIQUE,
  client_secret_hash text,
  allowed_scopes jsonb NOT NULL DEFAULT '["mcp:tools", "stellar:payments"]'::jsonb,
  redirect_uris jsonb NOT NULL,
  grant_types jsonb NOT NULL,
  token_endpoint_auth_method varchar(64) NOT NULL DEFAULT 'client_secret_post',
  mcp_slug varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_clients_owner_user_idx ON oauth_clients(owner_user_id);

CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id varchar(128) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_key_id uuid REFERENCES session_keys(id) ON DELETE SET NULL,
  code varchar(140) NOT NULL UNIQUE,
  code_challenge varchar(255),
  code_challenge_method varchar(20),
  scope text,
  redirect_uri text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_auth_codes_client_id_idx ON oauth_auth_codes(client_id);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id varchar(128) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_key_id uuid REFERENCES session_keys(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  scope text,
  mcp_slug varchar(80),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_client_id_idx ON oauth_access_tokens(client_id);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug varchar(80) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_servers_owner_user_idx ON mcp_servers(owner_user_id);

CREATE TABLE IF NOT EXISTS mcp_server_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_server_id uuid NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  proxy_id uuid NOT NULL REFERENCES api_proxies(id) ON DELETE CASCADE,
  tool_name varchar(120) NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_server_tools_server_id_idx ON mcp_server_tools(mcp_server_id);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  description text,
  workflow_definition jsonb NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workflow_templates_owner_user_idx ON workflow_templates(owner_user_id);

CREATE TABLE IF NOT EXISTS mcp_server_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_server_id uuid NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  workflow_template_id uuid NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  tool_name varchar(120) NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_server_workflows_server_id_idx ON mcp_server_workflows(mcp_server_id);

CREATE TABLE IF NOT EXISTS migration_metadata (
  key varchar(120) PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
