import type { WorkflowDefinition } from "@agent-loom/workflow";

/**
 * New workflows start from a valid, testable HTTP step (public URL).
 * `outputAs` keys the step in `$.steps.<outputAs>.output` expressions.
 */
export function createEmptyWorkflowDefinition(): WorkflowDefinition {
  return {
    version: "1.0",
    inputVariables: [],
    steps: [
      {
        id: "step-1",
        name: "HTTP request",
        type: "http",
        http: {
          method: "GET",
          url: "https://httpbin.org/get"
        },
        outputAs: "httpResult"
      }
    ],
    outputMapping: {
      result: "$.steps.httpResult.output"
    }
  };
}
