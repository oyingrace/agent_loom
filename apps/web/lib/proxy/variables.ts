export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const VARIABLE_TYPES = ["string", "number", "boolean", "array", "object"] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

export interface VariableValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: unknown[];
}

export interface VariableDefinition {
  name: string;
  type: VariableType;
  description: string;
  required: boolean;
  default?: unknown;
  example?: unknown;
  validation?: VariableValidation;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function extractVariables(
  headers: Headers,
  searchParams: URLSearchParams,
  body?: string
): Record<string, unknown> {
  const variables: Record<string, unknown> = {};

  const headerVars = headers.get("X-Variables");
  if (headerVars) {
    try {
      const parsed = JSON.parse(headerVars);
      if (typeof parsed === "object" && parsed !== null) {
        Object.assign(variables, parsed);
      }
    } catch {
      // ignore
    }
  }

  for (const [key, value] of searchParams.entries()) {
    if (!(key in variables)) {
      try {
        variables[key] = JSON.parse(value);
      } catch {
        variables[key] = value;
      }
    }
  }

  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed === "object" && parsed !== null) {
        if ("X-Variables" in parsed) {
          const bodyVars = parsed["X-Variables"] as Record<string, unknown>;
          if (typeof bodyVars === "object" && bodyVars !== null) {
            for (const [key, value] of Object.entries(bodyVars)) {
              if (!(key in variables)) {
                variables[key] = value;
              }
            }
          }
        }
        for (const [key, value] of Object.entries(parsed)) {
          if (key !== "X-Variables" && !(key in variables)) {
            variables[key] = value;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return variables;
}

export function validateVariables(
  schema: VariableDefinition[],
  values: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];

  for (const def of schema) {
    const value = values[def.name] ?? def.default;

    if (def.required && value === undefined) {
      errors.push(`Missing required variable: ${def.name}`);
      continue;
    }

    if (value === undefined) {
      continue;
    }

    const typeError = validateType(def.name, value, def.type);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    if (def.validation) {
      errors.push(...validateRules(def.name, value, def.type, def.validation));
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateType(name: string, value: unknown, expectedType: VariableType): string | null {
  switch (expectedType) {
    case "string":
      if (typeof value !== "string") {
        return `Variable '${name}' must be a string`;
      }
      break;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        return `Variable '${name}' must be a number`;
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        return `Variable '${name}' must be a boolean`;
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        return `Variable '${name}' must be an array`;
      }
      break;
    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return `Variable '${name}' must be an object`;
      }
      break;
  }
  return null;
}

function validateRules(
  name: string,
  value: unknown,
  type: VariableType,
  validation: VariableValidation
): string[] {
  const errors: string[] = [];

  if (type === "string" && typeof value === "string") {
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      errors.push(`Variable '${name}' must be at least ${validation.minLength} characters`);
    }
    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      errors.push(`Variable '${name}' must be at most ${validation.maxLength} characters`);
    }
    if (validation.pattern) {
      try {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          errors.push(`Variable '${name}' does not match required pattern`);
        }
      } catch {
        // skip
      }
    }
  }

  if (type === "number" && typeof value === "number") {
    if (validation.min !== undefined && value < validation.min) {
      errors.push(`Variable '${name}' must be at least ${validation.min}`);
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push(`Variable '${name}' must be at most ${validation.max}`);
    }
  }

  if (validation.enum && validation.enum.length > 0) {
    if (!validation.enum.includes(value)) {
      errors.push(`Variable '${name}' must be one of: ${validation.enum.join(", ")}`);
    }
  }

  return errors;
}

export function substituteVariables(
  template: string,
  values: Record<string, unknown>,
  schema: VariableDefinition[]
): string {
  const resolvedValues: Record<string, unknown> = {};
  for (const def of schema) {
    resolvedValues[def.name] = values[def.name] ?? def.default;
  }
  for (const [key, value] of Object.entries(values)) {
    if (!(key in resolvedValues)) {
      resolvedValues[key] = value;
    }
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    const value = resolvedValues[varName];
    if (value === undefined) {
      return match;
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

export function getMethodColor(method: HttpMethod): string {
  switch (method) {
    case "GET":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "POST":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "PUT":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "PATCH":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    case "DELETE":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  }
}
