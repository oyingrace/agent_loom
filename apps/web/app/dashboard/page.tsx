"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  LayoutDashboard,
  Loader2,
  Plug,
  Server,
  Workflow
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useUser } from "@/context/user";

type DashboardStats = {
  totals: {
    apiCount: number;
    workflowCount: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalEarnings: number;
  };
  recentLogs: {
    id: string;
    proxyName: string;
    statusCode: number;
    timestamp: string;
  }[];
};

export default function DashboardPage() {
  const { session, signIn, isLoading: authLoading } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setStats(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard/stats", { credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? `Failed to load stats (${res.status})`);
        }
        if (!cancelled) setStats(data as DashboardStats);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session && !authLoading) {
    return (
      <div className="container py-12">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Connect your Stellar wallet to view dashboard metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signIn()}>Sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="container flex justify-center py-16">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-12">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  const t = stats?.totals;

  return (
    <div className="container space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage proxies and workflows, and track request volume on Stellar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>APIs</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {t?.apiCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workflows</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {t?.workflowCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total requests</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {t?.totalRequests ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {t?.successfulRequests ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Manage</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/workflows">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Workflow className="size-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Your workflows</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="flex items-center justify-between">
                  Manage templates and runs
                  <ArrowRight className="size-4" />
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/mcp">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Plug className="size-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">MCP server</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="flex items-center justify-between">
                  Configure tools and workflows for your agents
                  <ArrowRight className="size-4" />
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
          <Link href="/proxies">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Server className="size-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">API proxies</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="flex items-center justify-between">
                  Payment-gated HTTP gateways
                  <ArrowRight className="size-4" />
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent requests</h2>
        <Card>
          <CardContent className="p-0">
            {!stats?.recentLogs?.length ? (
              <p className="text-muted-foreground p-6 text-sm">
                No proxy traffic logged yet.
              </p>
            ) : (
              <div className="divide-y">
                {stats.recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{log.proxyName}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {log.statusCode}
                    </span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
