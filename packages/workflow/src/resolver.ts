/**
 * JSONPath-like resolution for dry-run and transforms.
 * Context root: wallet, network, timestamp, input, steps
 */

export interface DryRunContext {
  wallet: string;
  network: string;
  timestamp: number;
  input: Record<string, unknown>;
  steps: Record<string, { output: unknown }>;
}

export function resolveExpression(
  expression: string,
  context: DryRunContext
): unknown {
  if (!expression.startsWith("$.")) {
    return expression;
  }

  const path = expression.slice(2);
  return resolvePath(path, context);
}

function resolvePath(path: string, obj: unknown): unknown {
  const segments = parsePath(path);
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment];
    } else {
      if (typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

function parsePath(path: string): (string | number)[] {
  const segments: (string | number)[] = [];
  const regex = /([^.\[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(path)) !== null) {
    if (match[1] !== undefined) {
      segments.push(match[1]);
    } else if (match[2] !== undefined) {
      segments.push(parseInt(match[2], 10));
    }
  }

  return segments;
}

export function resolveMapping(
  mapping: Record<string, unknown> | undefined,
  context: DryRunContext
): Record<string, unknown> | undefined {
  if (!mapping) {
    return undefined;
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === "string" && value.startsWith("$.")) {
      resolved[key] = resolveExpression(value, context);
    } else if (Array.isArray(value)) {
      resolved[key] = value.map((v) =>
        typeof v === "string" && v.startsWith("$.")
          ? resolveExpression(v, context)
          : v
      );
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export function resolveAllExpressions(
  value: unknown,
  context: DryRunContext
): unknown {
  if (typeof value === "string" && value.startsWith("$.")) {
    return resolveExpression(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveAllExpressions(item, context));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolveAllExpressions(val, context);
    }
    return result;
  }

  return value;
}
