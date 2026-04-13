import type { DryRunContext } from "./resolver";
import { resolveAllExpressions, resolveExpression, resolveMapping } from "./resolver";
import type { SorobanOperation, WorkflowDefinition, WorkflowStep } from "./types";

export interface StepResult {
  stepId: string;
  stepName: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  output?: unknown;
  error?: string;
  duration?: number;
}

export interface DryRunResult {
  success: boolean;
  steps: StepResult[];
  output?: Record<string, unknown>;
  error?: string;
}

function isUnresolvedSimulatedValue(
  value: unknown,
  expression: string | undefined
): boolean {
  return (
    value === undefined &&
    expression !== undefined &&
    expression.includes(".steps.")
  );
}

function simulateHttpStep(
  step: WorkflowStep,
  context: DryRunContext
): { output: unknown; error?: string } {
  if (!step.http) {
    return { output: null, error: "HTTP configuration missing" };
  }

  const resolvedBody = resolveMapping(step.http.bodyMapping, context);

  return {
    output: {
      _simulated: true,
      _message: "HTTP step would be executed (dry run)",
      proxyId: step.http.proxyId,
      url: step.http.url,
      method: step.http.method,
      body: resolvedBody
    }
  };
}

function resolveSorobanField(
  raw: string,
  context: DryRunContext
): { value: string | undefined; unresolved?: string } {
  if (!raw.startsWith("$.")) {
    return { value: raw };
  }
  const v = resolveExpression(raw, context);
  if (isUnresolvedSimulatedValue(v, raw)) {
    return { value: `<unresolved: ${raw}>`, unresolved: raw };
  }
  return { value: v === undefined ? undefined : String(v) };
}

interface SorobanSimResult {
  contractId: string | undefined;
  function: string;
  args: Record<string, unknown>;
  unresolvedExpressions?: string[];
}

function simulateSorobanOperation(
  op: SorobanOperation,
  context: DryRunContext
): SorobanSimResult {
  const cid = resolveSorobanField(op.contractId, context);
  const resolvedArgs = op.argsMapping
    ? (resolveMapping(op.argsMapping, context) ?? {})
    : {};

  const unresolved: string[] = [];
  if (cid.unresolved) {
    unresolved.push(`contractId: ${cid.unresolved}`);
  }
  if (op.argsMapping) {
    for (const [key, expr] of Object.entries(op.argsMapping)) {
      if (
        typeof expr === "string" &&
        isUnresolvedSimulatedValue(
          (resolvedArgs as Record<string, unknown>)[key],
          expr
        )
      ) {
        unresolved.push(`${key}: ${expr}`);
      }
    }
  }

  return {
    contractId: cid.value,
    function: op.function,
    args: resolvedArgs,
    unresolvedExpressions: unresolved.length ? unresolved : undefined
  };
}

function simulateSorobanStep(
  step: WorkflowStep,
  context: DryRunContext
): { output: unknown; error?: string } {
  if (step.type === "soroban" && step.soroban) {
    const out = simulateSorobanOperation(step.soroban, context);
    const unresolved = out.unresolvedExpressions as unknown[] | undefined;
    return {
      output: {
        _simulated: true,
        _message:
          unresolved && unresolved.length > 0
            ? "Soroban step has unresolved values (depends on prior HTTP)"
            : "Soroban step would be invoked",
        ...out
      }
    };
  }

  if (step.type === "soroban_batch" && step.soroban_batch) {
    const operations: Array<{ name: string } & SorobanSimResult> =
      step.soroban_batch.operations.map((op, i) => ({
        name: op.name ?? `Operation ${i + 1}`,
        ...simulateSorobanOperation(op, context)
      }));

    const hasUnresolved = operations.some(
      (o) => (o.unresolvedExpressions?.length ?? 0) > 0
    );

    return {
      output: {
        _simulated: true,
        _message: hasUnresolved
          ? "Batch has unresolved values"
          : "Soroban batch would be invoked",
        operations
      }
    };
  }

  return { output: null, error: "Invalid soroban step configuration" };
}

function runConditionStep(
  step: WorkflowStep,
  context: DryRunContext
): { output: unknown; error?: string } {
  if (!step.condition) {
    return { output: null, error: "Condition configuration missing" };
  }
  const resolved = resolveAllExpressions(step.condition.expression, context);
  return { output: Boolean(resolved) };
}

function runTransformStep(
  step: WorkflowStep,
  context: DryRunContext
): { output: unknown; error?: string } {
  if (!step.transform) {
    return { output: null, error: "Transform configuration missing" };
  }
  return { output: resolveAllExpressions(step.transform.expression, context) };
}

/**
 * Run a workflow without live HTTP or chain calls (dry run).
 */
export function runDryWorkflow(
  workflow: WorkflowDefinition,
  inputs: Record<string, unknown>,
  wallet: string,
  network: string
): DryRunResult {
  const context: DryRunContext = {
    wallet,
    network,
    timestamp: Math.floor(Date.now() / 1000),
    input: inputs,
    steps: {}
  };

  const stepResults: StepResult[] = [];

  for (const step of workflow.steps) {
    const startTime = Date.now();
    let result: { output: unknown; error?: string };

    try {
      switch (step.type) {
        case "http":
          result = simulateHttpStep(step, context);
          break;
        case "soroban":
        case "soroban_batch":
          result = simulateSorobanStep(step, context);
          break;
        case "condition":
          result = runConditionStep(step, context);
          break;
        case "transform":
          result = runTransformStep(step, context);
          break;
        default:
          result = {
            output: null,
            error: `Unknown step type: ${String(step.type)}`
          };
      }
    } catch (err) {
      result = {
        output: null,
        error: err instanceof Error ? err.message : "Unknown error"
      };
    }

    const duration = Date.now() - startTime;

    context.steps[step.outputAs] = { output: result.output };

    const status: StepResult["status"] = result.error
      ? step.onError === "skip"
        ? "skipped"
        : "error"
      : "success";

    stepResults.push({
      stepId: step.id,
      stepName: step.name,
      status,
      output: result.output,
      error: result.error,
      duration
    });

    if (result.error && step.onError !== "skip") {
      break;
    }
  }

  const hasError = stepResults.some((s) => s.status === "error");

  let output: Record<string, unknown> | undefined;
  if (!hasError && workflow.outputMapping) {
    output = {};
    for (const [key, expression] of Object.entries(workflow.outputMapping)) {
      output[key] = resolveExpression(expression, context);
    }
  }

  return {
    success: !hasError,
    steps: stepResults,
    output,
    error: hasError ? stepResults.find((s) => s.error)?.error : undefined
  };
}
