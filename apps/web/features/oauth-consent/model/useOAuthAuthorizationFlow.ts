"use client";

import { useMemo } from "react";
import type { OAuthAuthorizationState } from "./useOAuthAuthorization";

export type OAuthAuthorizationStep = "loading" | "error" | "signInRequired" | "ready" | "completed";

export function useOAuthAuthorizationFlow(
  authorization: OAuthAuthorizationState,
  opts: { isSignedIn: boolean; sessionHydrated: boolean }
): { step: OAuthAuthorizationStep; error: string | null } {
  const { isSignedIn, sessionHydrated } = opts;

  const step = useMemo((): OAuthAuthorizationStep => {
    if (authorization.isCompleted) return "completed";
    if (authorization.error) return "error";
    if (authorization.isLoading) return "loading";
    if (!authorization.clientInfo) return "loading";
    if (!sessionHydrated) return "loading";
    if (!isSignedIn) return "signInRequired";
    return "ready";
  }, [
    authorization.isCompleted,
    authorization.isLoading,
    authorization.error,
    authorization.clientInfo,
    isSignedIn,
    sessionHydrated
  ]);

  return { step, error: authorization.error };
}
