"use client";

import { Shield, FileSignature, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OAuthScopeInfo } from "../model/types";

interface ScopeApprovalCardProps {
  scope: OAuthScopeInfo;
  isSelected: boolean;
  onToggle: () => void;
}

export function ScopeApprovalCard({ scope, isSelected, onToggle }: ScopeApprovalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isEnforceable = scope.budgetEnforceable;
  const Icon = isEnforceable ? Shield : FileSignature;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      onClick={onToggle}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 size-5 rounded-full border-2 flex items-center justify-center transition-colors",
                isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
              )}
            >
              {isSelected && <CheckCircle2 className="size-3 text-primary-foreground" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "size-4",
                    isEnforceable ? "text-green-600" : "text-amber-600"
                  )}
                />
                <CardTitle className="text-base">{scope.name}</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">{scope.description}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0",
              isEnforceable
                ? "text-green-700 border-green-300 bg-green-50"
                : "text-amber-700 border-amber-300 bg-amber-50"
            )}
          >
            {isEnforceable ? "Limits Enforced" : "No Limits"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="size-3" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              Show details
            </>
          )}
        </button>

        {isExpanded && (
          <div className="mt-3 rounded-md bg-muted/30 border p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Scope ID:</span>{" "}
              <span className="font-mono">{scope.id}</span>
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">Type:</span> {scope.type}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
