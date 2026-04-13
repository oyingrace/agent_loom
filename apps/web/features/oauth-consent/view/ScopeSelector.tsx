"use client";

import { Label } from "@/components/ui/label";
import { ScopeApprovalCard } from "./ScopeApprovalCard";
import type { OAuthScopeInfo } from "../model/types";

interface ScopeSelectorProps {
  scopes: OAuthScopeInfo[];
  selectedScopeIds: string[];
  onToggleScope: (scopeId: string) => void;
}

/** Requested permissions list (Agent Fabric–style) for Stellar OAuth. */
export function ScopeSelector({ scopes, selectedScopeIds, onToggleScope }: ScopeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>Requested Permissions</Label>
      {scopes.map((scopeInfo) => (
        <ScopeApprovalCard
          key={scopeInfo.id}
          scope={scopeInfo}
          isSelected={selectedScopeIds.includes(scopeInfo.id)}
          onToggle={() => onToggleScope(scopeInfo.id)}
        />
      ))}
    </div>
  );
}
