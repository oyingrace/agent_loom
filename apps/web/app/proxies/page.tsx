"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Server,
  Trash2
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

type ProxyRow = {
  id: string;
  name: string;
  slug: string;
  targetUrl: string;
  isActive: boolean;
  createdAt: string;
};

function proxyUrls(origin: string, p: ProxyRow) {
  const base = origin.replace(/\/$/, "");
  return {
    byId: `${base}/api/proxy/${p.id}`,
    bySlug: `${base}/api/proxy/${p.slug}`
  };
}

export default function ProxiesPage() {
  const { session, signIn, isLoading: authLoading } = useUser();
  const [proxies, setProxies] = useState<ProxyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxies", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `Failed to load proxies (${res.status})`);
      }
      setProxies((data?.proxies ?? []) as ProxyRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setProxies(null);
      setLoading(false);
      return;
    }
    void load();
  }, [session, load]);

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this API proxy? This cannot be undone.")) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/proxies/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Delete failed (${res.status})`);
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  };

  if (!session && !authLoading) {
    return (
      <div className="container py-12">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Connect your Stellar wallet to manage payment-gated API proxies.
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

  if (error && !proxies) {
    return (
      <div className="container py-12">
        <p className="text-destructive text-sm">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">API proxies</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Stellar payment-gated HTTP proxies. Callers use{" "}
              <code className="text-xs">/api/proxy/&lt;id-or-slug&gt;</code> with{" "}
              <code className="text-xs">X-PAYMENT</code> after paying the memo.
            </p>
          </div>
          <Button asChild>
            <Link href="/proxies/new" className="gap-2">
              <Plus className="size-4" />
              New proxy
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-destructive mb-4 text-sm">{error}</p>
      ) : null}

      {!proxies?.length ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Server className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle>No proxies yet</CardTitle>
                <CardDescription>
                  Create a proxy pointing at your upstream API, set Stellar
                  pricing, and share the gateway URL.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/proxies/new">Create your first proxy</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {proxies.map((p) => {
            const urls = proxyUrls(origin, p);
            return (
              <li key={p.id}>
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {p.slug}
                        {!p.isActive ? (
                          <span className="text-destructive ml-2">(inactive)</span>
                        ) : null}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/proxies/${p.id}/edit`} className="gap-1">
                          <Pencil className="size-3.5" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive gap-1 hover:text-destructive"
                        onClick={() => void remove(p.id)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Target</span>
                      <p className="truncate font-mono text-xs">{p.targetUrl}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground shrink-0">
                          Gateway (id)
                        </span>
                        <code className="bg-muted max-w-full truncate rounded px-2 py-1 text-xs">
                          {urls.byId}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-8 shrink-0"
                          onClick={() =>
                            void copy(`id-${p.id}`, urls.byId)
                          }
                          aria-label="Copy gateway URL by id"
                        >
                          {copiedId === `id-${p.id}` ? (
                            <Check className="size-4 text-green-600" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground shrink-0">
                          Gateway (slug)
                        </span>
                        <code className="bg-muted max-w-full truncate rounded px-2 py-1 text-xs">
                          {urls.bySlug}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-8 shrink-0"
                          onClick={() =>
                            void copy(`slug-${p.id}`, urls.bySlug)
                          }
                          aria-label="Copy gateway URL by slug"
                        >
                          {copiedId === `slug-${p.id}` ? (
                            <Check className="size-4 text-green-600" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
