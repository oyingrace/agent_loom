"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/context/user";
import { useOAuthAuthorization } from "../model/useOAuthAuthorization";
import { useOAuthAuthorizationFlow } from "../model/useOAuthAuthorizationFlow";
import { AuthorizationActions } from "./AuthorizationActions";
import { AuthorizationError } from "./AuthorizationError";
import { AuthorizationLoading } from "./AuthorizationLoading";
import { AuthorizationSuccess } from "./AuthorizationSuccess";
import { ClientInfoHeader } from "./ClientInfoHeader";
import { NonEnforceableWarning } from "./NonEnforceableWarning";
import { RedirectInfo } from "./RedirectInfo";
import { ScopeSelector } from "./ScopeSelector";
import { SignInRequired } from "./SignInRequired";

export function OAuthAuthorizationView() {
  const { session, sessionHydrated, isLoading: userBusy, signIn } = useUser();
  const authorization = useOAuthAuthorization();
  const { step, error } = useOAuthAuthorizationFlow(authorization, {
    isSignedIn: Boolean(session),
    sessionHydrated
  });

  const {
    clientInfo,
    selectedScopeIds,
    toggleScope,
    hasNonEnforceableScope,
    handleApprove,
    handleDeny,
    isApproving,
    canApprove,
    approveError,
    isLoading
  } = authorization;

  if (step === "completed") {
    return <AuthorizationSuccess />;
  }

  if (step === "loading" && !error) {
    return (
      <AuthorizationLoading
        message={userBusy ? "Checking session…" : "Loading authorization request…"}
      />
    );
  }

  if (step === "error" && error) {
    return <AuthorizationError error={error} />;
  }

  if (step === "signInRequired") {
    return (
      <SignInRequired onSignIn={() => void signIn()} isSigningIn={userBusy} />
    );
  }

  if (!clientInfo) {
    return <AuthorizationLoading />;
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <ClientInfoHeader clientInfo={clientInfo} />

        <CardContent className="space-y-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>This application is requesting access to your Agent Loom account.</p>
            <p>Review the permissions below carefully.</p>
          </div>

          <ScopeSelector
            scopes={clientInfo.scopes}
            selectedScopeIds={selectedScopeIds}
            onToggleScope={toggleScope}
          />

          {hasNonEnforceableScope && <NonEnforceableWarning />}

          {approveError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{approveError}</p>
            </div>
          )}

          <AuthorizationActions
            onApprove={handleApprove}
            onDeny={handleDeny}
            isApproving={isApproving}
            canApprove={canApprove}
          />

          <RedirectInfo redirectUri={clientInfo.redirectUri} />
        </CardContent>
      </Card>
    </div>
  );
}
