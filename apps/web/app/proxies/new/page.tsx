"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { ProxyForm } from "@/components/proxies/ProxyForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useUser } from "@/context/user";

export default function NewProxyPage() {
  const { session, signIn, isLoading: authLoading } = useUser();

  if (!session && !authLoading) {
    return (
      <div className="container max-w-3xl py-12">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Connect your Stellar wallet to create an API proxy.
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
    <div className="container max-w-3xl py-8">
      <Button variant="ghost" size="sm" className="mb-6 gap-2" asChild>
        <Link href="/proxies">
          <ArrowLeft className="size-4" />
          All proxies
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">New API proxy</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Define an upstream URL and Stellar pricing. Callers hit your gateway on
          this app, pay via memo, then retry with{" "}
          <code className="text-xs">X-PAYMENT</code>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProxyForm mode="create" proxyId="" />
        </CardContent>
      </Card>
    </div>
  );
}
