"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { WorkflowDefinition } from "@agent-loom/workflow";

import { WorkflowEditorForm } from "@/components/workflows/WorkflowEditorForm";
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
  workflowDefinition: WorkflowDefinition;
};

export default function EditWorkflowPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { session, signIn, isLoading: authLoading } = useUser();
  const [workflow, setWorkflow] = useState<WorkflowRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !id) {
      setWorkflow(null);
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
  }, [session, id]);

  if (!session && !authLoading) {
    return (
      <div className="container max-w-4xl py-12">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Connect your Stellar wallet to edit this workflow.
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

  if (error || !workflow) {
    return (
      <div className="container max-w-4xl py-12">
        <Button variant="ghost" size="sm" className="mb-6 gap-2" asChild>
          <Link href="/workflows">
            <ArrowLeft className="size-4" />
            All workflows
          </Link>
        </Button>
        <p className="text-destructive text-sm">{error ?? "Not found"}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Button variant="ghost" size="sm" className="mb-6 gap-2" asChild>
        <Link href={`/workflows/${workflow.id}`}>
          <ArrowLeft className="size-4" />
          Back to workflow
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit workflow</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {workflow.name}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <WorkflowEditorForm
            key={workflow.id}
            mode="edit"
            workflowId={workflow.id}
            initialName={workflow.name}
            initialDescription={workflow.description ?? ""}
            initialIsPublic={workflow.isPublic}
            initialDefinition={workflow.workflowDefinition}
          />
        </CardContent>
      </Card>
    </div>
  );
}
