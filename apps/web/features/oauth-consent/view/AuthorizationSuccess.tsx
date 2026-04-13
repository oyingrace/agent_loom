"use client";

import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AuthorizationSuccess() {
  return (
    <div className="container max-w-lg mx-auto py-16 px-4">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="size-12 text-green-500" />
          <h2 className="mt-4 text-xl font-semibold">Authorization Complete</h2>
          <p className="mt-2 text-center text-muted-foreground">
            You have successfully authorized the application.
          </p>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            You can close this tab or return to Agent Loom.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Go to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
