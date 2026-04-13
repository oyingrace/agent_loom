import type { WorkflowDefinition, WorkflowStep } from "./types";
import type { StepResult, DryRunResult } from "./dryRun";
import { resolveAllExpressions, resolveExpression, resolveMapping } from "./resolver";

/** Legacy Horizon memo proof, or x402 base64 `PaymentPayload` header. */
export type XPaymentEvidence =
  | { txHash: string; paymentNonce: string }
  | { x402Header: string };

export type PaymentRequirements = {
  scheme?: string;
  proxyId?: string;
  paymentNonce?: string;
  stellar?: Record<string, unknown>;
  horizonUrl?: string | null;
  [key: string]: unknown;
};

/** Proxy / paid HTTP: wallet signs a payment payload. */
export type PaymentApprovalRequired = {
  kind: "payment";
  stepId: string;
  stepName: string;
  proxyId?: string;
  paymentRequirements: PaymentRequirements;
};

/** Soroban: user signs the prepared invoke tx (unsigned XDR). */
export type SorobanSignApprovalRequired = {
  kind: "soroban_sign";
  stepId: string;
  stepName: string;
  unsignedXdr: string;
  network: "testnet" | "public";
  sourceAccount: string;
};

export type ApprovalRequired = PaymentApprovalRequired | SorobanSignApprovalRequired;

/** Resume workflows with one or more user-signed Soroban txs (order matches workflow steps). */
export type SorobanResumptionEvidence = {
  completions: Array<{ stepId: string; signedTxXdr: string }>;
};

export type LiveExecutionResult =
  | {
      success: true;
      steps: StepResult[];
      output?: Record<string, unknown>;
    }
  | {
      success: false;
      steps: StepResult[];
      output?: Record<string, unknown>;
      approvalRequired?: ApprovalRequired;
      error?: string;
    };

export type LiveHttpExecutionResult = {
  output?: unknown;
  approvalRequired?: PaymentApprovalRequired;
};

export type ExecuteHttpStep = (params: {
  // WorkflowStep isn't modeled as a discriminated union, so we accept WorkflowStep
  // here and rely on runtime checks for `step.http`.
  step: WorkflowStep;
  resolvedBodyMapping: Record<string, unknown> | undefined;
  resolvedHeaders: Record<string, string> | undefined;
  network: string;
  wallet: string;
  x_payment?: XPaymentEvidence;
  // Where the caller can resolve request origin if needed
  context: {
    input: Record<string, unknown>;
    steps: Record<string, { output: unknown }>;
    timestamp: number;
  };
}) => Promise<LiveHttpExecutionResult>;

export type ExecuteSorobanStep = (params: {
  step: WorkflowStep;
  context: {
    input: Record<string, unknown>;
    steps: Record<string, { output: unknown }>;
    timestamp: number;
  };
  sorobanSigned?: SorobanResumptionEvidence;
}) => Promise<
  { output: unknown } | { approvalRequired: SorobanSignApprovalRequired }
>;

export async function runLiveWorkflow(
  workflow: WorkflowDefinition,
  inputs: Record<string, unknown>,
  wallet: string,
  network: string,
  x_payment: XPaymentEvidence | undefined,
  sorobanSigned: SorobanResumptionEvidence | undefined,
  hooks: {
    executeHttpStep: ExecuteHttpStep;
    executeSorobanStep?: ExecuteSorobanStep;
  },
): Promise<LiveExecutionResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const context = {
    wallet,
    network,
    timestamp,
    input: inputs,
    steps: {} as Record<string, { output: unknown }>
  };

  const stepResults: StepResult[] = [];

  for (const step of workflow.steps) {
    const startTime = Date.now();
    let status: StepResult["status"] = "running";
    let output: unknown = null;
    let error: string | undefined;
    let approvalRequired: ApprovalRequired | undefined;

    try {
      switch (step.type) {
        case "condition": {
          // Live runner uses the resolved condition output only.
          if (!step.condition) {
            throw new Error("Condition configuration missing");
          }
          const resolved = resolveAllExpressions(step.condition.expression, context);
          output = Boolean(resolved);
          break;
        }
        case "transform": {
          if (!step.transform) {
            throw new Error("Transform configuration missing");
          }
          output = resolveAllExpressions(step.transform.expression, context);
          break;
        }
        case "http": {
          if (!step.http) {
            throw new Error("HTTP configuration missing");
          }

          const resolvedBodyMapping = resolveMapping(step.http.bodyMapping, context);

          const resolvedHeaders =
            step.http.headers
              ? (resolveAllExpressions(step.http.headers, context) as Record<string, string>)
              : undefined;

          const res = await hooks.executeHttpStep({
            step,
            resolvedBodyMapping,
            resolvedHeaders,
            network,
            wallet,
            x_payment,
            context
          });

          if (res.approvalRequired) {
            status = "pending";
            approvalRequired = res.approvalRequired;
            break;
          }

          output = res.output;
          break;
        }
        case "soroban":
        case "soroban_batch": {
          if (!hooks.executeSorobanStep) {
            throw new Error("Soroban live execution is not implemented yet");
          }
          const sorobanRes = await hooks.executeSorobanStep({
            step,
            context,
            sorobanSigned
          });
          if ("approvalRequired" in sorobanRes) {
            status = "pending";
            approvalRequired = sorobanRes.approvalRequired;
            break;
          }
          output = sorobanRes.output;
          break;
        }
        default: {
          throw new Error(`Unknown step type: ${(step as WorkflowStep).type}`);
        }
      }

      if (!approvalRequired) {
        status = "success";
      }
    } catch (e) {
      status = step.onError === "skip" ? "skipped" : "error";
      error = e instanceof Error ? e.message : String(e);

      if (step.onError !== "skip") {
        // Mirror dry-run semantics: stop on first error unless configured to skip.
        stepResults.push({
          stepId: step.id,
          stepName: step.name,
          status,
          output,
          error,
          duration: Date.now() - startTime
        });
        return {
          success: false,
          steps: stepResults,
          error
        };
      }
    }

    if (approvalRequired) {
      stepResults.push({
        stepId: step.id,
        stepName: step.name,
        status,
        output,
        error,
        duration: Date.now() - startTime
      });
      return {
        success: false,
        steps: stepResults,
        approvalRequired
      };
    }

    stepResults.push({
      stepId: step.id,
      stepName: step.name,
      status,
      output,
      error,
      duration: Date.now() - startTime
    });

    // If this step produced output, make it available for later `$..steps.<outputAs>.output.*` lookups.
    context.steps[step.outputAs] = { output };
  }

  if (workflow.outputMapping) {
    const outputMapping: Record<string, unknown> = {};
    for (const [key, expression] of Object.entries(workflow.outputMapping)) {
      outputMapping[key] = resolveExpression(expression, context);
    }

    return { success: true, steps: stepResults, output: outputMapping };
  }

  return { success: true, steps: stepResults };
}

