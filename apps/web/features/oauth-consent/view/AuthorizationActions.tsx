"use client";

import { Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthorizationActionsProps {
  onApprove: () => void;
  onDeny: () => void;
  isApproving: boolean;
  canApprove: boolean;
}

export function AuthorizationActions({
  onApprove,
  onDeny,
  isApproving,
  canApprove
}: AuthorizationActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <Button variant="outline" onClick={onDeny} disabled={isApproving} className="flex-1">
        <X className="size-4 mr-2" />
        Deny
      </Button>
      <Button onClick={onApprove} disabled={!canApprove} className="flex-1">
        {isApproving ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            Authorizing…
          </>
        ) : (
          <>
            <ShieldCheck className="size-4 mr-2" />
            Authorize
          </>
        )}
      </Button>
    </div>
  );
}
