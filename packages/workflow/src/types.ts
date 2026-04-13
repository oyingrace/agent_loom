export interface SorobanOperation {
  name?: string;
  contractId: string;
  function: string;
  argsMapping?: Record<string, unknown>;
}

export interface HttpStepConfig {
  proxyId?: string;
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  bodyMapping?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: "http" | "condition" | "transform" | "soroban" | "soroban_batch";

  http?: HttpStepConfig;
  soroban?: SorobanOperation;
  soroban_batch?: { operations: SorobanOperation[] };

  condition?: {
    expression: unknown;
    onTrue?: string;
    onFalse?: string;
  };

  transform?: {
    expression: unknown;
  };

  inputMapping?: Record<string, string>;
  outputAs: string;
  requiresApproval?: boolean;
  onError?: "fail" | "skip" | "retry";

  /**
   * Who signs Soroban contract invocations for this step.
   * - `user` (default): unsigned XDR → wallet signs → server submits (Fabric-like custody).
   * - `hot`: server `WORKFLOW_HOT_WALLET_*` signs (legacy / demos).
   */
  sorobanSigner?: "user" | "hot";
}

export interface VariableDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "account";
  required?: boolean;
  default?: string | number | boolean;
  description?: string;
}

export interface WorkflowDefinition {
  version: "1.0";
  inputVariables?: VariableDefinition[];
  steps: WorkflowStep[];
  outputMapping: Record<string, string>;
}
