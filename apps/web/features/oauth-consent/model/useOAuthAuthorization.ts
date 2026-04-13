"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { OAuthClientInfo, OAuthParams, OAuthParamsValidation } from "./types";

async function fetchClientInfo(params: OAuthParams): Promise<OAuthClientInfo> {
  const {
    clientId,
    redirectUri,
    responseType,
    codeChallenge,
    codeChallengeMethod,
    scopeParam,
    state,
    mcpSlug
  } = params;

  if (
    !clientId ||
    !redirectUri ||
    !responseType ||
    !codeChallenge ||
    !codeChallengeMethod ||
    !scopeParam
  ) {
    throw new Error("Missing required OAuth parameters");
  }

  const searchParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    scope: scopeParam
  });
  if (state) searchParams.set("state", state);
  if (mcpSlug) searchParams.set("mcp_slug", mcpSlug);

  const response = await fetch(`/api/oauth/authorize?${searchParams}`);

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Failed to fetch client info");
  }

  return response.json() as Promise<OAuthClientInfo>;
}

function validateOAuthParams(params: OAuthParams): OAuthParamsValidation {
  const { clientId, redirectUri, responseType, codeChallenge, codeChallengeMethod, scopeParam } =
    params;

  if (!clientId || !redirectUri || !codeChallenge || !scopeParam) {
    return { isValid: false, error: "Missing required OAuth parameters" };
  }

  if (responseType !== "code") {
    return { isValid: false, error: "Only authorization code flow is supported" };
  }

  if (codeChallengeMethod !== "S256") {
    return { isValid: false, error: "Only S256 code challenge method is supported" };
  }

  return { isValid: true, error: null };
}

export function useOAuthAuthorization() {
  const searchParams = useSearchParams();

  const oauthParams: OAuthParams = useMemo(
    () => ({
      clientId: searchParams.get("client_id"),
      redirectUri: searchParams.get("redirect_uri"),
      responseType: searchParams.get("response_type"),
      codeChallenge: searchParams.get("code_challenge"),
      codeChallengeMethod: searchParams.get("code_challenge_method"),
      scopeParam: searchParams.get("scope"),
      state: searchParams.get("state"),
      mcpSlug: searchParams.get("mcp_slug")
    }),
    [searchParams]
  );

  const paramsValidation = useMemo(() => validateOAuthParams(oauthParams), [oauthParams]);

  const [clientInfo, setClientInfo] = useState<OAuthClientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const load = useCallback(async () => {
    if (!paramsValidation.isValid) {
      setIsLoading(false);
      setFetchError(null);
      return;
    }
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchClientInfo(oauthParams);
      setClientInfo(data);
      setSelectedScopeIds(data.scopes.map((s) => s.id));
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [oauthParams, paramsValidation.isValid]);

  const toggleScope = useCallback((scopeId: string) => {
    setSelectedScopeIds((prev) =>
      prev.includes(scopeId) ? prev.filter((id) => id !== scopeId) : [...prev, scopeId]
    );
  }, []);

  const handleApprove = useCallback(async () => {
    if (!clientInfo || selectedScopeIds.length === 0) return;
    setApproveError(null);
    setIsApproving(true);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_id: oauthParams.clientId,
          redirect_uri: oauthParams.redirectUri,
          code_challenge: oauthParams.codeChallenge,
          approved_scopes: selectedScopeIds,
          state: oauthParams.state,
          mcp_slug: oauthParams.mcpSlug ?? clientInfo.mcpSlug
        })
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Authorization failed");
      }

      const { redirect_uri: redirectTo } = (await res.json()) as { redirect_uri: string };
      setIsCompleted(true);

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "oauth-callback", redirectUri: redirectTo }, "*");
        window.close();
        return;
      }
      window.location.href = redirectTo;
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : "Authorization failed");
    } finally {
      setIsApproving(false);
    }
  }, [clientInfo, oauthParams, selectedScopeIds]);

  const handleDeny = useCallback(() => {
    if (!clientInfo) return;
    const redirectUrl = new URL(clientInfo.redirectUri);
    redirectUrl.searchParams.set("error", "access_denied");
    redirectUrl.searchParams.set(
      "error_description",
      "User denied the authorization request"
    );
    if (oauthParams.state) {
      redirectUrl.searchParams.set("state", oauthParams.state);
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "oauth-callback", redirectUri: redirectUrl.toString(), error: "access_denied" },
        "*"
      );
      window.close();
      return;
    }
    window.location.href = redirectUrl.toString();
  }, [clientInfo, oauthParams.state]);

  const error = useMemo(() => {
    if (!paramsValidation.isValid) return paramsValidation.error;
    return fetchError;
  }, [paramsValidation, fetchError]);

  const hasNonEnforceableScope = useMemo(() => {
    if (!clientInfo) return false;
    return clientInfo.scopes.some(
      (s) => selectedScopeIds.includes(s.id) && !s.budgetEnforceable
    );
  }, [clientInfo, selectedScopeIds]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    oauthParams,
    paramsValidation,
    clientInfo,
    isLoading,
    error,
    isCompleted,
    selectedScopeIds,
    toggleScope,
    hasNonEnforceableScope,
    handleApprove,
    handleDeny,
    approveError,
    isApproving,
    canApprove: selectedScopeIds.length > 0 && !isApproving,
    load
  };
}

export type OAuthAuthorizationState = ReturnType<typeof useOAuthAuthorization>;
