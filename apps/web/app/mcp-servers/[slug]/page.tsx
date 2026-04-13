import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Server, Workflow, Wrench } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import {
  mcpServerTools,
  mcpServerWorkflows,
  mcpServers,
  users
} from "@agent-loom/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getDb } from "@/lib/db";

type PageProps = { params: Promise<{ slug: string }> };

export default async function McpServerDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const db = getDb();

  const rows = await db
    .select({
      id: mcpServers.id,
      name: mcpServers.name,
      description: mcpServers.description,
      slug: mcpServers.slug,
      createdAt: mcpServers.createdAt,
      ownerAccount: users.accountAddress
    })
    .from(mcpServers)
    .innerJoin(users, eq(mcpServers.ownerUserId, users.id))
    .where(and(eq(mcpServers.slug, slug), eq(mcpServers.isPublic, true)))
    .limit(1);

  const server = rows[0];
  if (!server) {
    notFound();
  }

  const [toolRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(mcpServerTools)
    .where(
      and(
        eq(mcpServerTools.mcpServerId, server.id),
        eq(mcpServerTools.enabled, true)
      )
    );

  const [wfRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(mcpServerWorkflows)
    .where(
      and(
        eq(mcpServerWorkflows.mcpServerId, server.id),
        eq(mcpServerWorkflows.enabled, true)
      )
    );

  const toolCount = Number(toolRow?.c ?? 0);
  const workflowCount = Number(wfRow?.c ?? 0);

  return (
    <div className="container max-w-3xl space-y-8 py-8">
      <div>
        <Button variant="ghost" size="sm" className="mb-6 gap-2" asChild>
          <Link href="/mcp-servers">
            <ArrowLeft className="size-4" />
            Back to MCP Servers
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Server className="text-primary size-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{server.name}</h1>
              <p className="text-muted-foreground font-mono text-sm">/{server.slug}</p>
            </div>
          </div>
        </div>

        {server.description ? (
          <p className="text-muted-foreground mt-4 text-lg">{server.description}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Badge variant="secondary" className="gap-1">
            <Wrench className="size-3" />
            {toolCount} {toolCount === 1 ? "tool" : "tools"}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Workflow className="size-3" />
            {workflowCount} {workflowCount === 1 ? "workflow" : "workflows"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connect your MCP client</CardTitle>
          <CardDescription>
            Use OAuth with Agent Loom to authorize your AI assistant. Sign in with your Stellar
            wallet when the client opens the authorization flow, then approve the requested scopes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This server is published on Agent Loom. Add it in your MCP-compatible app (for example
            Claude Desktop or Cursor) using the MCP URL provided by the server operator, or connect
            through your workspace dashboard after signing in.
          </p>
          <p>
            Publisher:{" "}
            <span className="font-mono text-xs" title={server.ownerAccount}>
              {server.ownerAccount}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
