-- Fabric-style proxy variables & request templates

ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS variables_schema jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS request_body_template text;
ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS query_params_template text;
ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS content_type varchar(128) NOT NULL DEFAULT 'application/json';
ALTER TABLE api_proxies ADD COLUMN IF NOT EXISTS example_response text;
