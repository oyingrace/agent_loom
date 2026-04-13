"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VariablesBuilder } from "@/components/proxies/VariablesBuilder";
import {
  QueryParamsEditor,
  RequestTemplateEditor
} from "@/components/proxies/RequestTemplateEditor";
import { CATEGORY_LIST } from "@/features/proxy/model/tags";
import { HTTP_METHODS } from "@/features/proxy/model/variables";
import type { VariableDefinition } from "@/lib/proxy/variables";
import { createProxySchema } from "@/lib/validations/proxy";
import { cn } from "@/lib/utils";

export type ProxyFormValues = {
  name: string;
  slug: string;
  targetUrl: string;
  pricingAsset: string;
  pricingAmount: string;
  payoutAddress: string;
  isActive: boolean;
  encryptedHeadersText: string;
  description: string;
  category: string;
  tags: string;
  httpMethod: string;
  isPublic: boolean;
  contentType: string;
  queryParamsTemplate: string;
  requestBodyTemplate: string;
  variablesSchema: VariableDefinition[];
  exampleResponse: string;
};

const emptyValues: ProxyFormValues = {
  name: "",
  slug: "",
  targetUrl: "https://",
  pricingAsset: "native",
  pricingAmount: "1",
  payoutAddress: "",
  isActive: true,
  encryptedHeadersText: "",
  description: "",
  category: "",
  tags: "",
  httpMethod: "GET",
  isPublic: true,
  contentType: "application/json",
  queryParamsTemplate: "",
  requestBodyTemplate: "",
  variablesSchema: [],
  exampleResponse: ""
};

function normalizeHeadersJson(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const parsed = JSON.parse(t) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON object with string values");
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== "string") {
      throw new Error(`Header "${k}" must be a string`);
    }
    out[k] = v;
  }
  return JSON.stringify(out);
}

type Props = {
  mode: "create" | "edit";
  proxyId: string;
  initialValues?: Partial<ProxyFormValues>;
};

export function ProxyForm({ mode, proxyId, initialValues }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ProxyFormValues>({
    ...emptyValues,
    ...initialValues
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set =
    (key: keyof ProxyFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      setValues((prev) => ({ ...prev, [key]: v }));
    };

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      let encryptedHeaders: string | null = null;
      try {
        encryptedHeaders = normalizeHeadersJson(values.encryptedHeadersText);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid headers JSON");
        return;
      }

      const tagsArray = values.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);

      const variablesSchema = values.variablesSchema.filter(
        (v) => v.name.trim().length > 0
      );

      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        targetUrl: values.targetUrl.trim(),
        pricingAsset: values.pricingAsset.trim(),
        pricingAmount: values.pricingAmount.trim(),
        payoutAddress: values.payoutAddress.trim(),
        isActive: values.isActive,
        encryptedHeaders,
        description: values.description.trim() || undefined,
        category: values.category.trim() || undefined,
        tags: tagsArray,
        httpMethod: values.httpMethod,
        isPublic: values.isPublic,
        contentType: values.contentType.trim() || "application/json",
        queryParamsTemplate: values.queryParamsTemplate.trim() || null,
        requestBodyTemplate: values.requestBodyTemplate.trim() || null,
        exampleResponse: values.exampleResponse.trim() || null,
        variablesSchema
      };

      const parsed = createProxySchema.safeParse(payload);
      if (!parsed.success) {
        const flat = parsed.error.flatten();
        const msg =
          flat.formErrors[0] ??
          parsed.error.issues[0]?.message ??
          "Validation failed";
        setError(msg);
        return;
      }

      setSubmitting(true);
      try {
        if (mode === "create") {
          const res = await fetch("/api/proxies", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data)
          });
          const text = await res.text();
          if (!res.ok) {
            let msg = `Failed (${res.status})`;
            try {
              const j = JSON.parse(text) as { error?: string };
              if (j.error) msg = j.error;
            } catch {
              if (text) msg = text;
            }
            throw new Error(msg);
          }
          router.push("/proxies");
          router.refresh();
          return;
        }

        const { slug: _omitSlug, ...patchBody } = parsed.data;
        void _omitSlug;
        const res = await fetch(`/api/proxies/${proxyId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody)
        });
        const text = await res.text();
        if (!res.ok) {
          let msg = `Failed (${res.status})`;
          try {
            const j = JSON.parse(text) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            if (text) msg = text;
          }
          throw new Error(msg);
        }
        router.push("/proxies");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [mode, proxyId, router, values]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="proxy-name">Name</Label>
        <Input
          id="proxy-name"
          name="name"
          value={values.name}
          onChange={set("name")}
          required
          autoComplete="off"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-slug">Slug</Label>
        <Input
          id="proxy-slug"
          name="slug"
          value={values.slug}
          onChange={set("slug")}
          required
          autoComplete="off"
          className="font-mono text-sm"
          disabled={mode === "edit"}
          title={
            mode === "edit"
              ? "Slug cannot be changed (used in URLs)."
              : undefined
          }
        />
        <p className="text-muted-foreground text-xs">
          Lowercase letters, numbers, and hyphens (e.g. my-api). Used in{" "}
          <code className="text-xs">/api/proxy/&lt;slug&gt;</code>.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-description">Description (marketplace)</Label>
        <Textarea
          id="proxy-description"
          name="description"
          value={values.description}
          onChange={set("description")}
          placeholder="Short summary shown on the public API marketplace"
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="proxy-category">Category</Label>
          <select
            id="proxy-category"
            value={values.category || "none"}
            onChange={(e) =>
              setValues((p) => ({
                ...p,
                category: e.target.value === "none" ? "" : e.target.value
              }))
            }
            className={cn(
              "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none",
              "focus-visible:ring-[3px] dark:bg-input/30"
            )}
          >
            <option value="none">None</option>
            {CATEGORY_LIST.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="proxy-http-method">HTTP method (display)</Label>
          <select
            id="proxy-http-method"
            value={values.httpMethod}
            onChange={(e) =>
              setValues((p) => ({ ...p, httpMethod: e.target.value }))
            }
            className={cn(
              "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none",
              "focus-visible:ring-[3px] dark:bg-input/30"
            )}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-tags">Tags (comma-separated)</Label>
        <Input
          id="proxy-tags"
          name="tags"
          value={values.tags}
          onChange={set("tags")}
          placeholder="e.g. weather, stellar, api"
          autoComplete="off"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="proxy-public"
          type="checkbox"
          checked={values.isPublic}
          onChange={(e) =>
            setValues((p) => ({ ...p, isPublic: e.target.checked }))
          }
          className="size-4 rounded border"
        />
        <Label htmlFor="proxy-public" className="font-normal">
          List on public marketplace (/explore)
        </Label>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-target">Target URL</Label>
        <Input
          id="proxy-target"
          name="targetUrl"
          type="url"
          value={values.targetUrl}
          onChange={set("targetUrl")}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-content-type">Content-Type (upstream)</Label>
        <Input
          id="proxy-content-type"
          value={values.contentType}
          onChange={set("contentType")}
          placeholder="application/json"
          className="font-mono text-sm"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-query-template">Query parameters template (optional)</Label>
        <p className="text-muted-foreground text-xs">
          When set, only this query string is sent (after{" "}
          <code className="text-xs">{"{{variable}}"}</code> substitution). When empty, the
          caller&apos;s query string is forwarded as today.
        </p>
        <QueryParamsEditor
          value={values.queryParamsTemplate}
          onChange={(v) => setValues((p) => ({ ...p, queryParamsTemplate: v }))}
          existingVariables={values.variablesSchema.map((v) => v.name).filter(Boolean)}
          onAddVariables={(names) => {
            setValues((prev) => {
              const existing = new Set(prev.variablesSchema.map((v) => v.name));
              const next = [...prev.variablesSchema];
              for (const name of names) {
                if (!existing.has(name)) {
                  next.push({
                    name,
                    type: "string",
                    description: "",
                    required: false
                  });
                  existing.add(name);
                }
              }
              return { ...prev, variablesSchema: next };
            });
          }}
        />
      </div>

      {values.httpMethod !== "GET" && values.httpMethod !== "HEAD" ? (
        <div className="grid gap-2">
          <Label htmlFor="proxy-body-template">Request body template (optional)</Label>
          <p className="text-muted-foreground text-xs">
            JSON template with <code className="text-xs">{"{{name}}"}</code> placeholders. If
            empty, the caller&apos;s body is forwarded unchanged after payment.
          </p>
          <RequestTemplateEditor
            value={values.requestBodyTemplate}
            onChange={(v) => setValues((p) => ({ ...p, requestBodyTemplate: v }))}
            existingVariables={values.variablesSchema.map((v) => v.name).filter(Boolean)}
            onAddVariables={(names) => {
              setValues((prev) => {
                const existing = new Set(prev.variablesSchema.map((v) => v.name));
                const next = [...prev.variablesSchema];
                for (const name of names) {
                  if (!existing.has(name)) {
                    next.push({
                      name,
                      type: "string",
                      description: "",
                      required: false
                    });
                    existing.add(name);
                  }
                }
                return { ...prev, variablesSchema: next };
              });
            }}
          />
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label>Variables (optional)</Label>
        <p className="text-muted-foreground text-xs">
          Callers pass values via query, JSON body fields, or the{" "}
          <code className="text-xs">X-Variables</code> header. Values are validated before
          charging Stellar payment.
        </p>
        <VariablesBuilder
          variables={values.variablesSchema}
          onChange={(variablesSchema) => setValues((p) => ({ ...p, variablesSchema }))}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-example-response">Example response (optional)</Label>
        <Textarea
          id="proxy-example-response"
          value={values.exampleResponse}
          onChange={set("exampleResponse")}
          placeholder='{"ok": true}'
          rows={5}
          className="font-mono text-xs"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="proxy-asset">Pricing asset</Label>
          <Input
            id="proxy-asset"
            name="pricingAsset"
            value={values.pricingAsset}
            onChange={set("pricingAsset")}
            required
            className="font-mono text-sm"
          />
          <p className="text-muted-foreground text-xs">
            <code className="text-xs">native</code> or{" "}
            <code className="text-xs">CODE:ISSUER</code>
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="proxy-amount">Price (minimum)</Label>
          <Input
            id="proxy-amount"
            name="pricingAmount"
            value={values.pricingAmount}
            onChange={set("pricingAmount")}
            required
            className="font-mono text-sm"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-payout">Payout address</Label>
        <Input
          id="proxy-payout"
          name="payoutAddress"
          value={values.payoutAddress}
          onChange={set("payoutAddress")}
          required
          className="font-mono text-sm"
          autoComplete="off"
        />
        <p className="text-muted-foreground text-xs">
          Stellar account (G…) that receives payments for this proxy.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="proxy-headers">Upstream headers (optional JSON)</Label>
        <Textarea
          id="proxy-headers"
          name="encryptedHeadersText"
          value={values.encryptedHeadersText}
          onChange={set("encryptedHeadersText")}
          placeholder='{"Authorization":"Bearer ..."}'
          className="font-mono text-xs"
          rows={4}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="proxy-active"
          type="checkbox"
          checked={values.isActive}
          onChange={(e) =>
            setValues((p) => ({ ...p, isActive: e.target.checked }))
          }
          className="size-4 rounded border"
        />
        <Label htmlFor="proxy-active" className="font-normal">
          Active (reject traffic when off)
        </Label>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Saving…"
            : mode === "create"
              ? "Create proxy"
              : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/proxies")}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
