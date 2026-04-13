import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { workflowTemplates } from "@agent-loom/database";
import type {
  ApprovalRequired,
  LiveHttpExecutionResult,
  WorkflowDefinition
} from "@agent-loom/workflow";
import {
  runDryWorkflow,
  runLiveWorkflow,
  resolveExpression,
  resolveMapping,
  type SorobanResumptionEvidence,
  type XPaymentEvidence
} from "@agent-loom/workflow";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { prepareUnsignedSorobanInvoke } from "@/lib/stellar/prepareUserSorobanInvoke";
import { submitSignedSorobanTx } from "@/lib/stellar/submitSignedSorobanTx";
import { submitSorobanContractCall } from "@/lib/stellar/submitSorobanContractCall";

type Ctx = { params: Promise<{ id: string }> };

type ApprovalRequiredResponse = {
  error: "approval_required";
  approvalRequired: ApprovalRequired;
};

/**
 * POST /api/workflows/[id]/test
 * - Default: dry-run a workflow (no live HTTP or Soroban)
 * - When `dryRun: false`: attempt live workflow execution (paid HTTP + optional Soroban)
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await request.json()) as {
    inputs?: Record<string, unknown>;
    dryRun?: boolean;
    /**
     * Optional payment evidence for paid `http` steps.
     * Used by the hybrid 402 flow: if present, the step will include `X-PAYMENT`.
     */
    x_payment?: XPaymentEvidence;
    /** After the user signs a Soroban tx in their wallet (402 `soroban_sign`). */
    soroban_signed?: SorobanResumptionEvidence;
  };

  const db = getDb();
  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.id, id),
        eq(workflowTemplates.ownerUserId, user.id)
      )
    )
    .limit(1);

  const workflow = rows[0];
  if (!workflow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const webAppUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;

  const executeHttpStep = async (params: {
    // WorkflowStep isn't a discriminated union in the package types.
    // We rely on runtime checks for `params.step.http` below.
    step: any;
    resolvedBodyMapping: Record<string, unknown> | undefined;
    resolvedHeaders: Record<string, string> | undefined;
    network: string;
    wallet: string;
    x_payment?: XPaymentEvidence;
    context: unknown;
  }): Promise<LiveHttpExecutionResult> => {
    const httpCfg = params.step.http;
    if (!httpCfg) throw new Error("HTTP configuration missing");

    const method = (httpCfg.method ?? "GET") as "GET" | "POST";
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(params.resolvedHeaders ?? {})
    };

    if (method === "POST") {
      headers["Content-Type"] = "application/json";
    }

    const hasJsonBody = method === "POST";
    const body = hasJsonBody ? params.resolvedBodyMapping ?? {} : undefined;

    if (httpCfg.proxyId) {
      if (params.x_payment) {
        if ("x402Header" in params.x_payment && params.x_payment.x402Header) {
          headers["X-PAYMENT"] = params.x_payment.x402Header;
        } else if ("txHash" in params.x_payment && "paymentNonce" in params.x_payment) {
          headers["X-PAYMENT"] = JSON.stringify({
            txHash: params.x_payment.txHash,
            paymentNonce: params.x_payment.paymentNonce
          });
        }
      }

      const url = `${webAppUrl}/api/proxy/${httpCfg.proxyId}`;

      const res = await fetch(url, {
        method,
        headers,
        body: hasJsonBody ? JSON.stringify(body) : undefined
      });

      if (res.status === 402 && !params.x_payment) {
        const json = (await res.json()) as {
          error?: string;
          /** x402 primary shape */
          accepts?: unknown[];
          /** Same shape as legacy `paymentRequirements` (memo + Horizon) */
          legacyMemoPayment?: Record<string, unknown>;
          paymentRequirements?: Record<string, unknown>;
        };

        const rawBlock =
          json.legacyMemoPayment ??
          json.paymentRequirements ??
          (Array.isArray(json.accepts) && json.accepts[0]
            ? json.accepts[0]
            : undefined);
        if (!rawBlock || typeof rawBlock !== "object") {
          throw new Error(
            "Proxy returned 402 without payment instructions (accepts, legacyMemoPayment, or paymentRequirements)."
          );
        }
        const memoBlock = rawBlock as Record<string, unknown>;
        const proxyIdFromExtra =
          memoBlock.extra &&
          typeof memoBlock.extra === "object" &&
          memoBlock.extra !== null &&
          typeof (memoBlock.extra as { proxyId?: unknown }).proxyId === "string"
            ? (memoBlock.extra as { proxyId: string }).proxyId
            : undefined;
        const proxyId =
          typeof memoBlock.proxyId === "string"
            ? memoBlock.proxyId
            : proxyIdFromExtra;

        return {
          approvalRequired: {
            kind: "payment",
            stepId: params.step.id,
            stepName: params.step.name,
            proxyId,
            paymentRequirements: memoBlock
          }
        };
      }

      if (!res.ok) {
        const json = await res
          .json()
          .then((v) => v as { error?: string })
          .catch(() => null);
        const msg = json?.error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        return { output: await res.json() };
      }

      const text = await res.text();
      try {
        return { output: JSON.parse(text) };
      } catch {
        return { output: text };
      }
    }

    // External URL execution (unpaid).
    if (!httpCfg.url) {
      throw new Error("HTTP step must have either proxyId or url");
    }

    const res = await fetch(httpCfg.url, {
      method,
      headers,
      body: hasJsonBody ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return { output: await res.json() };
    }

    const text = await res.text();
    try {
      return { output: JSON.parse(text) };
    } catch {
      return { output: text };
    }
  };

  // Validate request shape (only relevant for live execution).
  if (body.dryRun === false && body.soroban_signed) {
    const sr = body.soroban_signed;
    if (!Array.isArray(sr.completions) || sr.completions.length === 0) {
      return NextResponse.json(
        {
          error: "Invalid soroban_signed",
          expected: {
            completions: [{ stepId: "string", signedTxXdr: "string" }]
          }
        },
        { status: 400 }
      );
    }
    for (const c of sr.completions) {
      if (
        typeof c.stepId !== "string" ||
        c.stepId.length === 0 ||
        typeof c.signedTxXdr !== "string" ||
        c.signedTxXdr.trim().length === 0
      ) {
        return NextResponse.json(
          {
            error: "Invalid soroban_signed.completions entry",
            expected: { stepId: "string", signedTxXdr: "string" }
          },
          { status: 400 }
        );
      }
    }
  }

  // Validate request shape (only relevant for live execution).
  if (body.dryRun === false && body.x_payment) {
    const xp = body.x_payment as XPaymentEvidence & Record<string, unknown>;
    const hasX402 =
      typeof xp.x402Header === "string" && xp.x402Header.trim().length > 0;
    const hasLegacy =
      typeof xp.txHash === "string" &&
      xp.txHash.length > 0 &&
      typeof xp.paymentNonce === "string" &&
      xp.paymentNonce.length > 0;
    if (!hasX402 && !hasLegacy) {
      return NextResponse.json(
        {
          error: "Invalid x_payment evidence",
          expected: {
            legacy: { txHash: "string", paymentNonce: "string" },
            x402: { x402Header: "string (base64 PaymentPayload)" }
          }
        },
        { status: 400 }
      );
    }
  }

  const def = workflow.workflowDefinition as unknown as WorkflowDefinition;
  const network =
    process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
  const sorobanNetwork = network as "testnet" | "public";

  const executeSorobanStep = async (params: {
    step: any;
    context: any;
    sorobanSigned?: SorobanResumptionEvidence;
  }): Promise<
    | { output: unknown }
    | { approvalRequired: Extract<ApprovalRequired, { kind: "soroban_sign" }> }
  > => {
    const s = params.step;
    const ctx = params.context;
    const signer = (s.sorobanSigner ?? "user") as "user" | "hot";

    const resolveInvoke = (op: {
      contractId: string;
      function: string;
      argsMapping?: Record<string, unknown>;
    }) => {
      const rawContractId: string = op.contractId;
      const resolvedContractId = rawContractId.startsWith("$.")
        ? resolveExpression(rawContractId, ctx)
        : rawContractId;

      if (typeof resolvedContractId !== "string" || !resolvedContractId) {
        throw new Error("Soroban contractId must resolve to a string");
      }

      const functionName: string = op.function;
      const resolvedArgsObj =
        op.argsMapping ? resolveMapping(op.argsMapping, ctx) ?? {} : {};

      const keys = Object.keys(resolvedArgsObj);
      const args = keys.map((k) => resolvedArgsObj[k]);
      if (args.some((v) => v === undefined)) {
        throw new Error("Soroban argsMapping contains unresolved values");
      }

      return { resolvedContractId, functionName, args };
    };

    if (s.type === "soroban" && s.soroban) {
      const { resolvedContractId, functionName, args } = resolveInvoke(s.soroban);

      const completions =
        body.soroban_signed?.completions ?? params.sorobanSigned?.completions ?? [];
      const match = [...completions].reverse().find((c) => c.stepId === s.id);
      if (match?.signedTxXdr?.trim()) {
        const { txHash } = await submitSignedSorobanTx({
          signedTxXdr: match.signedTxXdr,
          network: sorobanNetwork
        });
        return { output: { txHash } };
      }

      if (signer === "hot") {
        const { txHash } = await submitSorobanContractCall({
          invoke: {
            contractId: resolvedContractId,
            functionName,
            args
          },
          network
        });
        return { output: { txHash } };
      }

      const { unsignedXdr } = await prepareUnsignedSorobanInvoke({
        sourceAccount: user.accountAddress,
        contractId: resolvedContractId,
        functionName,
        args,
        network: sorobanNetwork
      });

      return {
        approvalRequired: {
          kind: "soroban_sign",
          stepId: s.id,
          stepName: s.name,
          unsignedXdr,
          network: sorobanNetwork,
          sourceAccount: user.accountAddress
        }
      };
    }

    if (s.type === "soroban_batch" && s.soroban_batch) {
      if (signer === "user") {
        throw new Error(
          'soroban_batch with sorobanSigner "user" is not supported yet; use separate soroban steps or set sorobanSigner to "hot".'
        );
      }

      const ops = s.soroban_batch.operations as Array<any>;

      const results: Array<{ txHash: string; functionName: string; contractId: string }> = [];
      for (const op of ops) {
        const { resolvedContractId, functionName, args } = resolveInvoke(op);

        const { txHash } = await submitSorobanContractCall({
          invoke: { contractId: resolvedContractId, functionName, args },
          network
        });
        results.push({ txHash, functionName, contractId: resolvedContractId });
      }

      return { output: { txHashes: results.map((r) => r.txHash), operations: results } };
    }

    throw new Error(`Unsupported Soroban step type: ${String(s?.type)}`);
  };

  const result =
    body.dryRun === false
      ? await runLiveWorkflow(
          def,
          body.inputs ?? {},
          user.accountAddress,
          network,
          body.x_payment,
          body.soroban_signed,
          {
            executeHttpStep,
            executeSorobanStep
          }
        )
      : runDryWorkflow(def, body.inputs ?? {}, user.accountAddress, network);

  if (body.dryRun === false) {
    const live = result as any;
    if (live?.success === false && live?.approvalRequired) {
      const resp: ApprovalRequiredResponse = {
        error: "approval_required",
        approvalRequired: live.approvalRequired
      };
      return NextResponse.json(resp, { status: 402 });
    }
  }

  return NextResponse.json(result);
}
