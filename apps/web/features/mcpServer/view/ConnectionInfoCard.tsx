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

function mcpBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_MCP_URL?.trim();
  const fromEnv = raw ? raw.replace(/\/$/, "") : "";
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function ConnectionInfoCard({ serverSlug, copied, onCopy }: Props) {
  const endpointUrl = `${mcpBaseUrl()}/mcp/${serverSlug}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection info</CardTitle>
        <CardDescription>
          MCP endpoint URL for clients (must be your{" "}
          <strong>MCP host</strong>, e.g. Render — not the Vercel web app unless MCP is
          served there). Set{" "}
          <code className="bg-muted rounded px-1 text-xs">NEXT_PUBLIC_MCP_URL</code> on
          Vercel.
        </CardDescription>
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
