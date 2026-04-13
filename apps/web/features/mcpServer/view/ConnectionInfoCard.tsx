"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Props = {
  serverSlug: string;
  copied: boolean;
  onCopy: () => void;
};

export function ConnectionInfoCard({ serverSlug, copied, onCopy }: Props) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const endpointUrl = `${base}/mcp/${serverSlug}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection info</CardTitle>
        <CardDescription>MCP endpoint URL for clients</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>MCP endpoint</Label>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 rounded px-3 py-2 text-sm break-all">
              {endpointUrl}
            </code>
            <Button variant="outline" size="icon" type="button" onClick={onCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
