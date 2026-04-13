import type { WorkflowDefinition, WorkflowStep } from "./types";

export function validateWorkflow(workflow: WorkflowDefinition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (workflow.version !== "1.0") {
    errors.push(`Unsupported workflow version: ${String(workflow.version)}`);
  }

  if (!workflow.steps || workflow.steps.length === 0) {
    errors.push("Workflow must have at least one step");
  }

  if (!workflow.outputMapping || typeof workflow.outputMapping !== "object") {
    errors.push("Workflow must include outputMapping object");
  }

  const stepIds = new Set<string>();
  for (const step of workflow.steps ?? []) {
    if (!step.id) {
      errors.push("Step missing id");
    } else if (stepIds.has(step.id)) {
      errors.push(`Duplicate step id: ${step.id}`);
    } else {
      stepIds.add(step.id);
    }

    if (!step.type) {
      errors.push(`Step "${step.id}" missing type`);
    }

    if (!step.outputAs) {
      errors.push(`Step "${step.id}" missing outputAs`);
    }

    validateStep(step, errors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateStep(step: WorkflowStep, errors: string[]): void {
  switch (step.type) {
    case "http":
      if (!step.http) {
        errors.push(`HTTP step "${step.id}" missing http configuration`);
      } else if (!step.http.proxyId && !step.http.url) {
        errors.push(`HTTP step "${step.id}" must have either proxyId or url`);
      }
      break;

    case "soroban":
      if (!step.soroban) {
        errors.push(`Soroban step "${step.id}" missing soroban configuration`);
      } else if (!step.soroban.contractId || !step.soroban.function) {
        errors.push(
          `Soroban step "${step.id}" requires contractId and function`
        );
      }
      break;

    case "soroban_batch":
      if (!step.soroban_batch?.operations?.length) {
        errors.push(
          `Soroban batch step "${step.id}" must include operations[]`
        );
      } else {
        step.soroban_batch.operations.forEach((op, i) => {
          if (!op.contractId || !op.function) {
            errors.push(
              `Soroban batch "${step.id}" operation ${i} needs contractId and function`
            );
          }
        });
      }
      break;

    case "condition":
      if (step.condition?.expression === undefined) {
        errors.push(`Condition step "${step.id}" missing condition expression`);
      }
      break;

    case "transform":
      if (step.transform?.expression === undefined) {
        errors.push(`Transform step "${step.id}" missing transform expression`);
      }
      break;

    default:
      errors.push(`Step "${step.id}" has unknown type: ${String(step.type)}`);
  }
}
