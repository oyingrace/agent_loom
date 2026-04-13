import type { InferSelectModel } from "drizzle-orm";
import { apiProxies } from "@agent-loom/database";
import { substituteVariables, type VariableDefinition } from "@/lib/proxy/variables";

type ProxyRow = InferSelectModel<typeof apiProxies>;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host"
]);

function parseStoredHeaders(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string") out[k] = val;
    }
    return out;
  } catch {
    return {};
  }
}

function variablesSchemaFromRow(proxy: ProxyRow): VariableDefinition[] {
  const raw = proxy.variablesSchema;
  if (!Array.isArray(raw)) return [];
  return raw as unknown as VariableDefinition[];
}

export async function forwardToTarget(params: {
  proxy: ProxyRow;
  incomingRequest: Request;
  requestBodyText: string | null;
  extractedVariables: Record<string, unknown>;
}): Promise<Response> {
  const { proxy, incomingRequest, requestBodyText, extractedVariables } = params;
  const variablesSchema = variablesSchemaFromRow(proxy);

  const incomingUrl = new URL(incomingRequest.url);

  let targetUrl: string;
  if (proxy.queryParamsTemplate?.trim()) {
    const substituted = substituteVariables(
      proxy.queryParamsTemplate,
      extractedVariables,
      variablesSchema
    );
    const sep = proxy.targetUrl.includes("?") ? "&" : "?";
    targetUrl = `${proxy.targetUrl}${sep}${substituted}`;
  } else {
    const target = new URL(proxy.targetUrl);
    incomingUrl.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });
    targetUrl = target.toString();
  }

  const stored = parseStoredHeaders(proxy.encryptedHeaders);

  const outHeaders = new Headers();
  for (const [k, v] of Object.entries(stored)) {
    outHeaders.set(k, v);
  }

  const pass = [
    "accept",
    "accept-encoding",
    "accept-language",
    "user-agent",
    "x-request-id"
  ];
  for (const name of pass) {
    const v = incomingRequest.headers.get(name);
    if (v && !outHeaders.has(name)) {
      outHeaders.set(name, v);
    }
  }

  for (const [k] of incomingRequest.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower.startsWith("x-") && lower !== "x-payment" && !outHeaders.has(k)) {
      const v = incomingRequest.headers.get(k);
      if (v) outHeaders.set(k, v);
    }
  }

  outHeaders.set("content-type", proxy.contentType || "application/json");

  const method = proxy.httpMethod || incomingRequest.method;

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (proxy.requestBodyTemplate?.trim()) {
      body = substituteVariables(
        proxy.requestBodyTemplate,
        extractedVariables,
        variablesSchema
      );
    } else if (requestBodyText) {
      body = requestBodyText;
    }
  }

  for (const h of HOP_BY_HOP) {
    outHeaders.delete(h);
  }

  const init: RequestInit = {
    method,
    headers: outHeaders,
    redirect: "manual"
  };

  if (body !== undefined) {
    init.body = body;
  }

  const timeoutMs = 30_000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  init.signal = controller.signal;

  try {
    return await fetch(targetUrl, init);
  } finally {
    clearTimeout(t);
  }
}
