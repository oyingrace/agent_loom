"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";

import { WorkflowTestPanel } from "@/components/workflows/WorkflowTestPanel";
import { Button } from "@/components/ui/button";
import type { WorkflowDefinition } from "@agent-loom/workflow";
import { useUser } from "@/context/user";

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  workflowDefinition: WorkflowDefinition;
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { session } = useUser();
  const [workflow, setWorkflow] = useState<WorkflowRow | null>(null);
  const [role, setRole] = useState<"owner" | "public" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setWorkflow(null);
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workflows/${id}`, {
          credentials: "include"
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? `Failed to load workflow (${res.status})`);
        }
        if (!cancelled) {
          setWorkflow(data.workflow as WorkflowRow);
          setRole(data.role as "owner" | "public");
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
  }, [id]);

  if (loading) {
    return (
      <div className="container flex justify-center py-16">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="container py-12">
        <Button variant="outline" size="sm" asChild className="mb-6">
          <Link href="/workflows">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <p className="text-destructive text-sm">{error ?? "Not found"}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/workflows">
          <ArrowLeft className="size-4" />
          All workflows
        </Link>
      </Button>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{workflow.name}</h1>
          {workflow.description ? (
            <p className="text-muted-foreground mt-2">{workflow.description}</p>
          ) : null}
          {role === "public" && !session ? (
            <p className="text-muted-foreground mt-3 text-sm">
              Sign in to run or edit workflows you own.
            </p>
          ) : null}
        </div>
        {role === "owner" ? (
          <Button variant="outline" size="sm" asChild className="shrink-0 gap-2">
            <Link href={`/workflows/${workflow.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
        ) : null}
      </div>

      <WorkflowTestPanel workflowId={workflow.id} workflow={workflow.workflowDefinition} />
    </div>
  );
}
