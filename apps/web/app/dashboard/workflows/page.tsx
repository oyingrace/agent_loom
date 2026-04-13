"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useUser } from "@/context/user";

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
};

export default function DashboardWorkflowsPage() {
  const { session, signIn, isLoading: authLoading } = useUser();
  const [workflows, setWorkflows] = useState<WorkflowRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setWorkflows(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/workflows", { credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? `Failed to load workflows (${res.status})`);
        }
        if (!cancelled) {
          setWorkflows((data?.workflows ?? []) as WorkflowRow[]);
        }
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
              Connect a Stellar wallet to list and edit your workflow templates.
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

  return (
    <div className="container py-8">
      <Button variant="ghost" size="sm" className="mb-6 gap-2" asChild>
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </Button>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your workflows</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Open a workflow to dry-run or execute live with Stellar payments. Public templates also
            appear on{" "}
            <Link href="/workflows" className="text-primary underline-offset-4 hover:underline">
              /workflows
            </Link>
            .
          </p>
        </div>
        <Button asChild>
          <Link href="/workflows/new" className="gap-2">
            <Plus className="size-4" />
            New workflow
          </Link>
        </Button>
      </div>

      {!workflows?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No workflows yet</CardTitle>
            <CardDescription>
              Create a workflow with the visual editor, or seed rows in Postgres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/workflows/new">Create workflow</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {workflows.map((w) => (
            <li key={w.id}>
              <Link href={`/workflows/${w.id}`}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="flex flex-row items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Workflow className="text-primary size-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">{w.name}</CardTitle>
                      {w.description ? (
                        <CardDescription className="line-clamp-2">{w.description}</CardDescription>
                      ) : null}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
