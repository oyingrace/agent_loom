-- Public marketplace metadata for API proxies (Agent Fabric–style explore)

ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS category varchar(64);
ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS http_method varchar(16) NOT NULL DEFAULT 'GET';

CREATE INDEX IF NOT EXISTS api_proxies_public_active_idx
  ON api_proxies (is_public, is_active)
  WHERE is_public = true AND is_active = true;
