/**
 * OAuth consent types (Agent Fabric–aligned) for Agent Loom Stellar flows.
 */

export interface OAuthClientInfo {
  client: {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
  };
  scopes: OAuthScopeInfo[];
  redirectUri: string;
  state: string | null;
  mcpSlug?: string | null;
}

export interface OAuthScopeInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  budgetEnforceable: boolean;
}

export interface OAuthParams {
  clientId: string | null;
  redirectUri: string | null;
  responseType: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  scopeParam: string | null;
  state: string | null;
  mcpSlug: string | null;
}

export interface OAuthParamsValidation {
  isValid: boolean;
  error: string | null;
}
