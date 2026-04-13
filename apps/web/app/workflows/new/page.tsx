"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

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

export default function NewWorkflowPage() {
  const { session, signIn, isLoading: authLoading } = useUser();

  if (!session && !authLoading) {
    return (
      <div className="container max-w-4xl py-12">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Connect your Stellar wallet to create a workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signIn()}>Sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading || !session) {
    return (
      <div className="container flex justify-center py-16">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Button variant="ghost" size="sm" className="mb-6 gap-2" asChild>
        <Link href="/workflows">
          <ArrowLeft className="size-4" />
          All workflows
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">New workflow</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Define steps (HTTP, Soroban, condition, transform), inputs, and output
          mapping. Saved definitions are validated with{" "}
          <code className="text-xs">@agent-loom/workflow</code>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <WorkflowEditorForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
