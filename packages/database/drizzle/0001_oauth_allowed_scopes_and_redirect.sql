-- For databases created from 0000 before allowed_scopes / redirect_uri existed.

ALTER TABLE oauth_clients
  ADD COLUMN IF NOT EXISTS allowed_scopes jsonb NOT NULL DEFAULT '["mcp:tools", "stellar:payments"]'::jsonb;

ALTER TABLE oauth_auth_codes
  ADD COLUMN IF NOT EXISTS redirect_uri text;
