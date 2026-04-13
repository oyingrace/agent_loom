"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  VariableDefinition,
  WorkflowDefinition,
  WorkflowStep
} from "@agent-loom/workflow";
import { validateWorkflow } from "@agent-loom/workflow";

import { createEmptyWorkflowDefinition } from "@/lib/workflows/defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  mode: "create" | "edit";
  workflowId?: string;
  initialName?: string;
  initialDescription?: string;
  initialIsPublic?: boolean;
  initialDefinition?: WorkflowDefinition;
};

function parseJsonOrUndefined<T>(raw: string): T | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  return JSON.parse(t) as T;
}

function stepFromType(
  type: WorkflowStep["type"],
  id: string,
  name: string,
  outputAs: string
): WorkflowStep {
  switch (type) {
    case "http":
      return {
        id,
        name,
        type: "http",
        http: { method: "GET", url: "https://httpbin.org/get" },
        outputAs
      };
    case "soroban":
      return {
        id,
        name,
        type: "soroban",
        soroban: { contractId: "", function: "" },
        sorobanSigner: "user",
        outputAs
      };
    case "soroban_batch":
      return {
        id,
        name,
        type: "soroban_batch",
        soroban_batch: {
          operations: [{ contractId: "", function: "" }]
        },
        sorobanSigner: "hot",
        outputAs
      };
    case "condition":
      return {
        id,
        name,
        type: "condition",
        condition: { expression: true },
        outputAs
      };
    case "transform":
      return {
        id,
        name,
        type: "transform",
        transform: { expression: "$.input" },
        outputAs
      };
    default:
      return {
        id,
        name,
        type: "http",
        http: { method: "GET", url: "https://httpbin.org/get" },
        outputAs
      };
  }
}

export function WorkflowEditorForm({
  mode,
  workflowId,
  initialName = "",
  initialDescription = "",
  initialIsPublic = false,
  initialDefinition
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [definition, setDefinition] = useState<WorkflowDefinition>(
    () => initialDefinition ?? createEmptyWorkflowDefinition()
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateStep = useCallback((index: number, step: WorkflowStep) => {
    setDefinition((d) => ({
      ...d,
      steps: d.steps.map((s, i) => (i === index ? step : s))
    }));
  }, []);

  const addStep = useCallback(() => {
    const n = definition.steps.length + 1;
    const id = `step-${crypto.randomUUID().slice(0, 8)}`;
    setDefinition((d) => ({
      ...d,
      steps: [
        ...d.steps,
        stepFromType("http", id, `Step ${n}`, `step${n}`)
      ]
    }));
  }, [definition.steps.length]);

  const removeStep = useCallback(
    (index: number) => {
      if (definition.steps.length <= 1) return;
      setDefinition((d) => ({
        ...d,
        steps: d.steps.filter((_, i) => i !== index)
      }));
    },
    [definition.steps.length]
  );

  const addInputVariable = useCallback(() => {
    const v: VariableDefinition = {
      name: "",
      type: "string",
      required: false,
      description: ""
    };
    setDefinition((d) => ({
      ...d,
      inputVariables: [...(d.inputVariables ?? []), v]
    }));
  }, []);

  const updateInputVariable = useCallback(
    (index: number, patch: Partial<VariableDefinition>) => {
      setDefinition((d) => {
        const list = [...(d.inputVariables ?? [])];
        const prev = list[index];
        if (!prev) return d;
        const next: VariableDefinition = {
          name: patch.name ?? prev.name,
          type: patch.type ?? prev.type,
          required: patch.required ?? prev.required,
          description: patch.description ?? prev.description,
          default: patch.default !== undefined ? patch.default : prev.default
        };
        list[index] = next;
        return { ...d, inputVariables: list };
      });
    },
    []
  );

  const removeInputVariable = useCallback((index: number) => {
    setDefinition((d) => ({
      ...d,
      inputVariables: (d.inputVariables ?? []).filter((_, i) => i !== index)
    }));
  }, []);

  const addOutputMapping = useCallback(() => {
    setDefinition((d) => ({
      ...d,
      outputMapping: {
        ...d.outputMapping,
        [`field${Object.keys(d.outputMapping).length + 1}`]: "$.steps.httpResult.output"
      }
    }));
  }, []);

  const updateOutputKey = useCallback((oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    setDefinition((d) => {
      const { [oldKey]: val, ...rest } = d.outputMapping;
      const value = val ?? "";
      return {
        ...d,
        outputMapping: { ...rest, [newKey]: value }
      };
    });
  }, []);

  const updateOutputValue = useCallback((key: string, value: string) => {
    setDefinition((d) => ({
      ...d,
      outputMapping: { ...d.outputMapping, [key]: value }
    }));
  }, []);

  const removeOutputMapping = useCallback((key: string) => {
    setDefinition((d) => {
      const rest = { ...d.outputMapping };
      delete rest[key];
      return { ...d, outputMapping: rest };
    });
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError("Name is required");
        return;
      }

      const v = validateWorkflow(definition);
      if (!v.valid) {
        setError(v.errors.join("; "));
        return;
      }

      setSubmitting(true);
      try {
        const payload = {
          name: trimmedName,
          description: description.trim() || null,
          isPublic,
          workflowDefinition: definition
        };

        if (mode === "create") {
          const res = await fetch("/api/workflows", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          let data: Record<string, unknown> | null = null;
          try {
            data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
          } catch {
            data = null;
          }
          if (!res.ok) {
            const details = data?.details;
            const detailStr = Array.isArray(details)
              ? details.join(", ")
              : typeof details === "string"
                ? details
                : null;
            const msg =
              (typeof data?.error === "string" ? data.error : null) ??
              detailStr ??
              text ??
              `Failed (${res.status})`;
            throw new Error(msg);
          }
          const wf = data?.workflow as { id?: string } | undefined;
          const id = wf?.id;
          router.push(id ? `/workflows/${id}` : "/workflows");
          router.refresh();
          return;
        }

        if (!workflowId) {
          throw new Error("Missing workflow id");
        }

        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        let data: Record<string, unknown> | null = null;
        try {
          data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
        } catch {
          data = null;
        }
        if (!res.ok) {
          const details = data?.details;
          const detailStr = Array.isArray(details)
            ? details.join(", ")
            : typeof details === "string"
              ? details
              : null;
          const msg =
            (typeof data?.error === "string" ? data.error : null) ??
            detailStr ??
            text ??
            `Failed (${res.status})`;
          throw new Error(msg);
        }
        router.push(`/workflows/${workflowId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [definition, description, isPublic, mode, name, router, workflowId]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <div className="grid gap-2">
          <Label htmlFor="wf-name">Name</Label>
          <Input
            id="wf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wf-desc">Description</Label>
          <Textarea
            id="wf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="wf-public"
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="size-4 rounded border"
          />
          <Label htmlFor="wf-public" className="font-normal">
            Public (visible in public listings when enabled)
          </Label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Input variables</h2>
          <Button type="button" variant="outline" size="sm" onClick={addInputVariable}>
            <Plus className="size-4" />
            Add variable
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Declared inputs are available as <code className="text-xs">$.input.name</code>{" "}
          in expressions.
        </p>
        {(definition.inputVariables ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No input variables.</p>
        ) : (
          <ul className="space-y-3">
            {(definition.inputVariables ?? []).map((iv, i) => (
              <li
                key={i}
                className="bg-muted/40 flex flex-wrap items-end gap-2 rounded-lg border p-3"
              >
                <div className="grid min-w-[120px] flex-1 gap-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={iv.name}
                    onChange={(e) =>
                      updateInputVariable(i, { name: e.target.value })
                    }
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid w-[130px] gap-1">
                  <Label className="text-xs">Type</Label>
                  <select
                    className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                    value={iv.type}
                    onChange={(e) =>
                      updateInputVariable(i, {
                        type: e.target.value as VariableDefinition["type"]
                      })
                    }
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="account">account</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={!!iv.required}
                    onChange={(e) =>
                      updateInputVariable(i, { required: e.target.checked })
                    }
                    className="size-4"
                  />
                  <span className="text-xs">Required</span>
                </div>
                <div className="grid min-w-[180px] flex-[2] gap-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={iv.description ?? ""}
                    onChange={(e) =>
                      updateInputVariable(i, { description: e.target.value })
                    }
                    className="text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => removeInputVariable(i)}
                  aria-label="Remove variable"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Steps</h2>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="size-4" />
            Add step
          </Button>
        </div>
        <div className="space-y-4">
          {definition.steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              index={index}
              canRemove={definition.steps.length > 1}
              onChange={(s) => updateStep(index, s)}
              onRemove={() => removeStep(index)}
              onTypeChange={(type) => {
                const next = stepFromType(
                  type,
                  step.id,
                  step.name,
                  step.outputAs
                );
                updateStep(index, next);
              }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Output mapping</h2>
          <Button type="button" variant="outline" size="sm" onClick={addOutputMapping}>
            <Plus className="size-4" />
            Add field
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Values are expressions: use{" "}
          <code className="text-xs">$.steps.&lt;outputAs&gt;.output</code> to pass
          step results to the workflow output.
        </p>
        <ul className="space-y-2">
          {Object.entries(definition.outputMapping).map(([key, value], oi) => (
            <li key={`${oi}-${key}`} className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-[160px] font-mono text-xs"
                defaultValue={key}
                onBlur={(e) => {
                  const nk = e.target.value.trim();
                  if (nk && nk !== key) updateOutputKey(key, nk);
                }}
              />
              <span className="text-muted-foreground">→</span>
              <Input
                className="min-w-[200px] flex-1 font-mono text-xs"
                value={value}
                onChange={(e) => updateOutputValue(key, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
                onClick={() => removeOutputMapping(key)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Saving…"
            : mode === "create"
              ? "Create workflow"
              : "Save workflow"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/workflows")}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function StepCard({
  step,
  index,
  canRemove,
  onChange,
  onRemove,
  onTypeChange
}: {
  step: WorkflowStep;
  index: number;
  canRemove: boolean;
  onChange: (s: WorkflowStep) => void;
  onRemove: () => void;
  onTypeChange: (t: WorkflowStep["type"]) => void;
}) {
  return (
    <div className="bg-card space-y-4 rounded-xl border p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-muted-foreground text-xs font-medium">
          Step {index + 1}
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive h-8"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Step id</Label>
          <Input
            className="font-mono text-xs"
            value={step.id}
            onChange={(e) => onChange({ ...step, id: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input
            value={step.name}
            onChange={(e) => onChange({ ...step, name: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label>outputAs</Label>
          <Input
            className="font-mono text-xs"
            value={step.outputAs}
            onChange={(e) => onChange({ ...step, outputAs: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label>Type</Label>
          <select
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            value={step.type}
            onChange={(e) =>
              onTypeChange(e.target.value as WorkflowStep["type"])
            }
          >
            <option value="http">http</option>
            <option value="soroban">soroban</option>
            <option value="soroban_batch">soroban_batch</option>
            <option value="condition">condition</option>
            <option value="transform">transform</option>
          </select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!step.requiresApproval}
            onChange={(e) =>
              onChange({ ...step, requiresApproval: e.target.checked })
            }
            className="size-4"
            id={`appr-${step.id}`}
          />
          <Label htmlFor={`appr-${step.id}`} className="font-normal">
            Requires approval (paid proxy)
          </Label>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">On error</Label>
          <select
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            value={step.onError ?? "fail"}
            onChange={(e) =>
              onChange({
                ...step,
                onError: e.target.value as WorkflowStep["onError"]
              })
            }
          >
            <option value="fail">fail</option>
            <option value="skip">skip</option>
            <option value="retry">retry</option>
          </select>
        </div>
      </div>

      {step.type === "http" ? (
        <HttpStepFields step={step} onChange={onChange} />
      ) : null}
      {step.type === "soroban" ? (
        <SorobanStepFields step={step} onChange={onChange} />
      ) : null}
      {step.type === "soroban_batch" ? (
        <SorobanBatchFields step={step} onChange={onChange} />
      ) : null}
      {step.type === "condition" ? (
        <ConditionFields step={step} onChange={onChange} />
      ) : null}
      {step.type === "transform" ? (
        <TransformFields step={step} onChange={onChange} />
      ) : null}
    </div>
  );
}

function HttpStepFields({
  step,
  onChange
}: {
  step: WorkflowStep;
  onChange: (s: WorkflowStep) => void;
}) {
  const http = step.http ?? {};
  const [headersText, setHeadersText] = useState(() =>
    http.headers ? JSON.stringify(http.headers, null, 2) : ""
  );
  const [bodyText, setBodyText] = useState(() =>
    http.bodyMapping ? JSON.stringify(http.bodyMapping, null, 2) : ""
  );

  useEffect(() => {
    const h = step.http ?? {};
    setHeadersText(h.headers ? JSON.stringify(h.headers, null, 2) : "");
    setBodyText(h.bodyMapping ? JSON.stringify(h.bodyMapping, null, 2) : "");
  }, [step.id, step.type]);

  const commitHeaders = () => {
    const raw = headersText.trim();
    let headers: Record<string, string> | undefined;
    if (raw) {
      try {
        const p = parseJsonOrUndefined<Record<string, unknown>>(raw);
        if (!p || typeof p !== "object")
          throw new Error("headers must be a JSON object");
        headers = {};
        for (const [k, v] of Object.entries(p)) {
          if (typeof v === "string") headers[k] = v;
        }
      } catch {
        return;
      }
    }
    onChange({
      ...step,
      http: { ...http, headers }
    });
  };

  const commitBody = () => {
    const raw = bodyText.trim();
    let bodyMapping: Record<string, unknown> | undefined;
    if (raw) {
      try {
        bodyMapping = parseJsonOrUndefined<Record<string, unknown>>(raw);
      } catch {
        return;
      }
    }
    onChange({
      ...step,
      http: { ...http, bodyMapping }
    });
  };

  return (
    <div className="border-muted space-y-3 border-t pt-4">
      <p className="text-sm font-medium">HTTP</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-xs">Proxy id (optional)</Label>
          <Input
            className="font-mono text-xs"
            placeholder="UUID of /api/proxy/…"
            value={http.proxyId ?? ""}
            onChange={(e) =>
              onChange({
                ...step,
                http: {
                  ...http,
                  proxyId: e.target.value.trim() || undefined
                }
              })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">URL (optional if proxy set)</Label>
          <Input
            className="font-mono text-xs"
            value={http.url ?? ""}
            onChange={(e) =>
              onChange({
                ...step,
                http: { ...http, url: e.target.value.trim() || undefined }
              })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">Method</Label>
          <select
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            value={http.method ?? "GET"}
            onChange={(e) =>
              onChange({
                ...step,
                http: {
                  ...http,
                  method: e.target.value as "GET" | "POST"
                }
              })
            }
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Headers (JSON object)</Label>
        <Textarea
          className="font-mono text-xs"
          rows={2}
          placeholder="{}"
          value={headersText}
          onChange={(e) => setHeadersText(e.target.value)}
          onBlur={commitHeaders}
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Body mapping (JSON object, POST)</Label>
        <Textarea
          className="font-mono text-xs"
          rows={3}
          placeholder='{"key": "$.input.x"}'
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          onBlur={commitBody}
        />
      </div>
    </div>
  );
}

function SorobanStepFields({
  step,
  onChange
}: {
  step: WorkflowStep;
  onChange: (s: WorkflowStep) => void;
}) {
  const s = step.soroban ?? { contractId: "", function: "" };
  const [argsText, setArgsText] = useState(() =>
    s.argsMapping ? JSON.stringify(s.argsMapping, null, 2) : ""
  );

  useEffect(() => {
    const sb = step.soroban;
    setArgsText(
      sb?.argsMapping ? JSON.stringify(sb.argsMapping, null, 2) : ""
    );
  }, [step.id, step.type]);

  const commitArgs = () => {
    const raw = argsText.trim();
    let argsMapping: Record<string, unknown> | undefined;
    if (raw) {
      try {
        argsMapping = parseJsonOrUndefined<Record<string, unknown>>(raw);
      } catch {
        return;
      }
    }
    onChange({
      ...step,
      soroban: {
        ...(step.soroban ?? { contractId: "", function: "" }),
        argsMapping
      }
    });
  };

  return (
    <div className="border-muted space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Soroban</p>
      <div className="grid gap-2">
        <Label className="text-xs">Signer</Label>
        <select
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs focus-visible:ring-2 focus-visible:outline-none"
          value={step.sorobanSigner ?? "user"}
          onChange={(e) =>
            onChange({
              ...step,
              sorobanSigner: e.target.value as "user" | "hot"
            })
          }
        >
          <option value="user">Your wallet (unsigned XDR → you sign)</option>
          <option value="hot">Server hot wallet (legacy)</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Contract id</Label>
        <Input
          className="font-mono text-xs"
          value={s.contractId}
          onChange={(e) =>
            onChange({
              ...step,
              soroban: { ...s, contractId: e.target.value }
            })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Function</Label>
        <Input
          className="font-mono text-xs"
          value={s.function}
          onChange={(e) =>
            onChange({
              ...step,
              soroban: { ...s, function: e.target.value }
            })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Args mapping (JSON)</Label>
        <Textarea
          className="font-mono text-xs"
          rows={4}
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          onBlur={commitArgs}
        />
      </div>
    </div>
  );
}

function SorobanBatchFields({
  step,
  onChange
}: {
  step: WorkflowStep;
  onChange: (s: WorkflowStep) => void;
}) {
  const batch = step.soroban_batch ?? { operations: [] };
  const [text, setText] = useState(() =>
    JSON.stringify(batch.operations, null, 2)
  );

  useEffect(() => {
    const ops = step.soroban_batch?.operations ?? [];
    setText(JSON.stringify(ops, null, 2));
  }, [step.id, step.type]);

  const commit = () => {
    try {
      const ops = JSON.parse(text) as unknown;
      if (!Array.isArray(ops)) return;
      onChange({
        ...step,
        soroban_batch: {
          operations: ops as NonNullable<
            WorkflowStep["soroban_batch"]
          >["operations"]
        }
      });
    } catch {
      /* invalid */
    }
  };

  return (
    <div className="border-muted space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Soroban batch</p>
      <div className="grid gap-2">
        <Label className="text-xs">Signer</Label>
        <select
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs focus-visible:ring-2 focus-visible:outline-none"
          value={step.sorobanSigner ?? "hot"}
          onChange={(e) =>
            onChange({
              ...step,
              sorobanSigner: e.target.value as "user" | "hot"
            })
          }
        >
          <option value="hot">Server hot wallet (batch)</option>
          <option value="user">Your wallet — not supported for batch yet</option>
        </select>
      </div>
      <Textarea
        className="font-mono text-xs"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}

function ConditionFields({
  step,
  onChange
}: {
  step: WorkflowStep;
  onChange: (s: WorkflowStep) => void;
}) {
  const c = step.condition ?? { expression: true };
  const exprRaw =
    typeof c.expression === "string"
      ? c.expression
      : JSON.stringify(c.expression, null, 2);
  return (
    <div className="border-muted space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Condition</p>
      <div className="grid gap-2">
        <Label className="text-xs">Expression (JSON or $.path)</Label>
        <Textarea
          className="font-mono text-xs"
          rows={3}
          value={exprRaw}
          onChange={(e) => {
            const raw = e.target.value.trim();
            let expression: unknown = raw;
            try {
              expression = raw.startsWith("$") ? raw : JSON.parse(raw);
            } catch {
              expression = raw;
            }
            onChange({
              ...step,
              condition: {
                ...c,
                expression
              }
            });
          }}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label className="text-xs">onTrue (step id)</Label>
          <Input
            value={c.onTrue ?? ""}
            onChange={(e) =>
              onChange({
                ...step,
                condition: {
                  ...c,
                  onTrue: e.target.value.trim() || undefined
                }
              })
            }
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">onFalse (step id)</Label>
          <Input
            value={c.onFalse ?? ""}
            onChange={(e) =>
              onChange({
                ...step,
                condition: {
                  ...c,
                  onFalse: e.target.value.trim() || undefined
                }
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

function TransformFields({
  step,
  onChange
}: {
  step: WorkflowStep;
  onChange: (s: WorkflowStep) => void;
}) {
  const t = step.transform ?? { expression: "$.input" };
  const exprRaw =
    typeof t.expression === "string"
      ? t.expression
      : JSON.stringify(t.expression, null, 2);
  return (
    <div className="border-muted space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Transform</p>
      <Textarea
        className="font-mono text-xs"
        rows={3}
        value={exprRaw}
        onChange={(e) => {
          const raw = e.target.value.trim();
          let expression: unknown = raw;
          try {
            expression = raw.startsWith("$") ? raw : JSON.parse(raw);
          } catch {
            expression = raw;
          }
          onChange({
            ...step,
            transform: { expression }
          });
        }}
      />
    </div>
  );
}
