import { Suspense } from "react";
import { OAuthAuthorizationView } from "@/features/oauth-consent/view/OAuthAuthorizationView";
import { AuthorizationLoading } from "@/features/oauth-consent/view/AuthorizationLoading";

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={<AuthorizationLoading />}>
      <OAuthAuthorizationView />
    </Suspense>
  );
}
