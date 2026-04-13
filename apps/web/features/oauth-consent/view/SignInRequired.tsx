"use client";

import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SignInRequiredProps {
  onSignIn: () => void;
  isSigningIn: boolean;
}

export function SignInRequired({ onSignIn, isSigningIn }: SignInRequiredProps) {
  return (
    <div className="container max-w-lg mx-auto py-16 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto size-14 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <Wallet className="size-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Sign in to continue</CardTitle>
          <p className="text-sm text-muted-foreground pt-2">
            Connect your Stellar wallet to approve this application&apos;s access to your Agent Loom
            account.
          </p>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <Button onClick={onSignIn} disabled={isSigningIn} size="lg">
            {isSigningIn ? "Opening wallet…" : "Sign in with Stellar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
