"use client";

import { AlertTriangle } from "lucide-react";

/** Shown when the user selects scopes that are not fully enforceable on-chain. */
export function NonEnforceableWarning() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-800">Limited on-chain enforcement</p>
          <p className="text-sm text-amber-700 mt-1">
            Some permissions cannot enforce spending limits on-chain for Stellar delegated actions.
            Review carefully before authorizing.
          </p>
        </div>
      </div>
    </div>
  );
}
