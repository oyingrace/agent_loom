"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import {
  ProxyForm,
  type ProxyFormValues
} from "@/components/proxies/ProxyForm";
import type { VariableDefinition } from "@/lib/proxy/variables";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useUser } from "@/context/user";

type ProxyApi = {
  id: string;
  name: string;
  slug: string;
  targetUrl: string;
  pricingAsset: string;
  pricingAmount: string;
  payoutAddress: string;
  encryptedHeaders: string | null;
  isActive: boolean;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  httpMethod: string | null;
  isPublic: boolean | null;
  contentType: string | null;
  queryParamsTemplate: string | null;
  requestBodyTemplate: string | null;
  exampleResponse: string | null;
  variablesSchema: unknown;
};

function headersToText(raw: string | null): string {
  if (!raw?.trim()) return "";
  try {
    return JSON.stringify(JSON.parse(raw) as object, null, 2);
  } catch {
    return raw;
  }
}

export default function EditProxyPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { session, signIn, isLoading: authLoading } = useUser();
  const [proxy, setProxy] = useState<ProxyApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !id) {
      setProxy(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/proxies/${id}`, {
          credentials: "include"
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? `Failed to load proxy (${res.status})`);
        }
        if (!cancelled) {
          setProxy(data.proxy as ProxyApi);
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
      <div className="container max-w-3xl py-12">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Connect your Stellar wallet to edit this proxy.
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

  if (error || !proxy) {
    return (
      <div className="container max-w-3xl py-12">
        <Button variant="ghost" size="sm" className="mb-6 gap-2" asChild>
          <Link href="/proxies">
            <ArrowLeft className="size-4" />
            All proxies
          </Link>
        </Button>
        <p className="text-destructive text-sm">
          {error ?? "Proxy not found."}
        </p>
      </div>
    );
  }

  const tagList = Array.isArray(proxy.tags) ? proxy.tags : [];
  const vs = proxy.variablesSchema;
  const variablesSchema: VariableDefinition[] = Array.isArray(vs)
    ? (vs as VariableDefinition[])
    : [];

  const initialValues: Partial<ProxyFormValues> = {
    name: proxy.name,
    slug: proxy.slug,
    targetUrl: proxy.targetUrl,
    pricingAsset: proxy.pricingAsset,
    pricingAmount: proxy.pricingAmount,
    payoutAddress: proxy.payoutAddress,
    isActive: proxy.isActive,
    encryptedHeadersText: headersToText(proxy.encryptedHeaders),
    description: proxy.description ?? "",
    category: proxy.category ?? "",
    tags: tagList.join(", "),
    httpMethod: proxy.httpMethod ?? "GET",
    isPublic: proxy.isPublic ?? true,
    contentType: proxy.contentType ?? "application/json",
    queryParamsTemplate: proxy.queryParamsTemplate ?? "",
    requestBodyTemplate: proxy.requestBodyTemplate ?? "",
    exampleResponse: proxy.exampleResponse ?? "",
    variablesSchema
  };

  return (
    <div className="container max-w-3xl py-8">
      <Button variant="ghost" size="sm" className="mb-6 gap-2" asChild>
        <Link href="/proxies">
          <ArrowLeft className="size-4" />
          All proxies
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit proxy</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {proxy.name}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProxyForm
            mode="edit"
            proxyId={proxy.id}
            initialValues={initialValues}
          />
        </CardContent>
      </Card>
    </div>
  );
}
