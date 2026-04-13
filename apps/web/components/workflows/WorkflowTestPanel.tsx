"use client";

import { useMemo, useState } from "react";
import {
  Account,
  Asset,
  Memo,
  Operation,
  TransactionBuilder
} from "@stellar/stellar-base";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import type { VariableDefinition, WorkflowDefinition } from "@agent-loom/workflow";

import { parsePricingAsset } from "@/lib/stellar/parsePricingAsset";
import {
  buildSignedX402PaymentHeader,
  isX402PaymentRequirements
} from "@/lib/x402/clientPayment";
import { useUser } from "@/context/user";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Legacy memo + Horizon payment block from `legacyMemoPayment`. */
type LegacyMemoPaymentRequirements = {
  paymentNonce: string;
  horizonUrl: string | null;
  stellar: {
    asset: string;
    amount: string;
    destination: string;
  };
};

function assetToStellarBase(assetStr: string): Asset {
  const parsed = parsePricingAsset(assetStr);
  if (parsed.kind === "native") return Asset.native();
  return new Asset(parsed.code, parsed.issuer);
}

function coerceInputValue(
  def: VariableDefinition | undefined,
  raw: unknown
): unknown {
  if (!def) return raw;
  if (raw === undefined || raw === null) return raw;
  switch (def.type) {
    case "number":
      if (typeof raw === "number") return raw;
      if (typeof raw === "string" && raw.trim() === "") return undefined;
      if (typeof raw === "string") return Number(raw);
      return raw;
    case "boolean":
      if (typeof raw === "boolean") return raw;
      if (typeof raw === "string") return raw === "true";
      return !!raw;
    default:
      return typeof raw === "string" ? raw : String(raw);
  }
}

export function WorkflowTestPanel({
  workflowId,
  workflow
}: {
  workflowId: string;
  workflow: WorkflowDefinition;
}) {
  const { walletAddress, session } = useUser();
  const inputVariables = workflow.inputVariables ?? [];

  const initialInputs = useMemo(() => {
    const record: Record<string, unknown> = {};
    for (const def of inputVariables) {
      if (def.default !== undefined) record[def.name] = def.default;
    }
    return record;
  }, [inputVariables]);

  const [inputs, setInputs] = useState<Record<string, unknown>>(initialInputs);
  const [mode, setMode] = useState<"dry" | "live">("dry");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function submitLegacyMemoPayment(
    payment: LegacyMemoPaymentRequirements
  ): Promise<{ txHash: string }> {
    const payer = walletAddress ?? session?.accountAddress ?? null;
    if (!payer) throw new Error("Connect your wallet to pay for this step.");

    const horizonUrl = (payment.horizonUrl ?? "").trim();
    if (!horizonUrl) throw new Error("Missing horizonUrl in payment requirements");

    const net = await StellarWalletsKit.getNetwork();
    const networkPassphrase = net.networkPassphrase;

    const asset = assetToStellarBase(payment.stellar.asset);
    const amount = String(payment.stellar.amount);
    const destination = payment.stellar.destination;
    const paymentNonce = payment.paymentNonce;

    const acctRes = await fetch(
      `${horizonUrl.replace(/\/$/, "")}/accounts/${encodeURIComponent(payer)}`
    );
    if (!acctRes.ok) {
      throw new Error(`Failed to load payer account from Horizon (${acctRes.status})`);
    }
    const acctJson = (await acctRes.json()) as { sequence: string };
    const sequence = String(acctJson.sequence);
    if (!sequence) {
      throw new Error("Invalid account sequence from Horizon");
    }

    const txBuilder = new TransactionBuilder(new Account(payer, sequence), {
      fee: "100",
      networkPassphrase
    });

    txBuilder.addMemo(Memo.text(paymentNonce));
    txBuilder.addOperation(
      Operation.payment({
        destination,
        asset,
        amount
      })
    );

    const tx = txBuilder.build();
    const signed = await StellarWalletsKit.signTransaction(tx.toXDR(), {
      networkPassphrase,
      address: payer
    });

    const submitRes = await fetch(`${horizonUrl.replace(/\/$/, "")}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tx: signed.signedTxXdr })
    });

    const submitJson = (await submitRes.json().catch(() => ({}))) as {
      hash?: string;
      extras?: { result_codes?: { transaction?: string } };
    };
    if (!submitRes.ok) {
      const detail =
        submitJson?.extras?.result_codes?.transaction ??
        JSON.stringify(submitJson);
      throw new Error(`Payment submit failed: ${detail}`);
    }
    const txHash = submitJson.hash;
    if (!txHash) throw new Error("Horizon did not return a transaction hash");
    return { txHash };
  }

  async function runTest() {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const resolvedInputs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(inputs)) {
        const def = inputVariables.find((d) => d.name === k);
        resolvedInputs[k] = coerceInputValue(def, v);
      }

      type SorobanCompletion = { stepId: string; signedTxXdr: string };

      const postWorkflow = async (params: {
        dryRun: boolean;
        x_payment?: { txHash: string; paymentNonce: string } | { x402Header: string };
        sorobanCompletions?: SorobanCompletion[];
      }) => {
        const body: Record<string, unknown> = {
          inputs: resolvedInputs,
          dryRun: params.dryRun
        };
        if (params.x_payment) body.x_payment = params.x_payment;
        if (params.sorobanCompletions && params.sorobanCompletions.length > 0) {
          body.soroban_signed = { completions: params.sorobanCompletions };
        }
        return fetch(`/api/workflows/${workflowId}/test`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      };

      const handle402 = async (
        json: {
          error?: string;
          approvalRequired?: {
            kind?: string;
            paymentRequirements?: unknown;
            unsignedXdr?: string;
            stepId?: string;
          };
        },
        sorobanCompletions: SorobanCompletion[]
      ): Promise<unknown> => {
        if (json?.error !== "approval_required" || !json?.approvalRequired) {
          throw new Error(json?.error ?? "Approval required");
        }
        const ar = json.approvalRequired;

        if (ar.kind === "soroban_sign" || (ar.unsignedXdr && !ar.paymentRequirements)) {
          if (mode !== "live") {
            throw new Error(
              "This workflow needs a live run to sign Soroban steps in your wallet."
            );
          }
          const payer = walletAddress ?? session?.accountAddress ?? null;
          if (!payer) throw new Error("Connect your Stellar wallet to sign this step.");

          const unsignedXdr = ar.unsignedXdr;
          if (!unsignedXdr || !ar.stepId) {
            throw new Error("Invalid soroban_sign approval (missing unsigned XDR or step id)");
          }

          const net = await StellarWalletsKit.getNetwork();
          const signed = await StellarWalletsKit.signTransaction(unsignedXdr, {
            networkPassphrase: net.networkPassphrase,
            address: payer
          });

          const nextCompletions: SorobanCompletion[] = [
            ...sorobanCompletions,
            { stepId: ar.stepId, signedTxXdr: signed.signedTxXdr }
          ];

          const retry = await postWorkflow({
            dryRun: false,
            sorobanCompletions: nextCompletions
          });

          if (retry.status === 402) {
            const retryJson = (await retry.json()) as typeof json;
            return handle402(retryJson, nextCompletions);
          }

          const retryJson = await retry.json().catch(() => null);
          if (!retry.ok) {
            throw new Error(
              (retryJson as { error?: string })?.error ??
                "Live workflow failed after Soroban signature"
            );
          }
          return retryJson;
        }

        if (
          ar.kind === "payment" ||
          (ar.paymentRequirements !== undefined && ar.paymentRequirements !== null)
        ) {
          if (mode !== "live") {
            throw new Error(
              "This workflow needs a live run to complete payment-gated steps."
            );
          }

          const payer = walletAddress ?? session?.accountAddress ?? null;
          if (!payer) throw new Error("Connect your wallet to pay for this step.");

          const net = await StellarWalletsKit.getNetwork();
          const networkPassphrase = net.networkPassphrase;

          const pr = ar.paymentRequirements;

          let xPayment:
            | { txHash: string; paymentNonce: string }
            | { x402Header: string };

          if (isX402PaymentRequirements(pr)) {
            const x402Header = await buildSignedX402PaymentHeader({
              requirements: pr,
              payer,
              networkPassphrase,
              signTransaction: (xdr) =>
                StellarWalletsKit.signTransaction(xdr, {
                  networkPassphrase,
                  address: payer
                })
            });
            xPayment = { x402Header };
          } else {
            const legacy = pr as LegacyMemoPaymentRequirements;
            const { txHash } = await submitLegacyMemoPayment(legacy);
            xPayment = {
              txHash,
              paymentNonce: legacy.paymentNonce
            };
          }

          const retry = await postWorkflow({
            dryRun: false,
            x_payment: xPayment,
            sorobanCompletions
          });

          if (retry.status === 402) {
            const retryJson = (await retry.json()) as typeof json;
            return handle402(retryJson, sorobanCompletions);
          }

          const retryJson = await retry.json().catch(() => null);
          if (!retry.ok) {
            throw new Error(
              (retryJson as { error?: string })?.error ??
                "Live workflow failed after payment"
            );
          }
          return retryJson;
        }

        throw new Error("Unknown approval_required payload");
      };

      const res = await postWorkflow({
        dryRun: mode === "dry"
      });

      if (res.status === 402) {
        const json = (await res.json()) as Parameters<typeof handle402>[0];
        const resultJson = await handle402(json, []);
        setResult(resultJson);
        return;
      }

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (json as { error?: string })?.error ?? `Request failed (${res.status})`
        );
      }
      setResult(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow test</CardTitle>
        <CardDescription>
          Dry-run simulates steps. Live run executes HTTP/Soroban steps; paid proxy
          steps open your wallet to sign a Stellar payment (legacy memo or x402).
          Soroban steps with signer “your wallet” use your key (unsigned XDR → Freighter),
          then the server submits; hot-wallet signer is optional for demos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {inputVariables.length > 0 && (
          <div className="grid gap-3">
            {inputVariables.map((def) => (
              <label key={def.name} className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">
                  {def.name}
                  {def.required ? " *" : ""}
                  {def.description ? ` — ${def.description}` : ""}
                </span>
                {def.type === "boolean" ? (
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={!!inputs[def.name]}
                    onChange={(e) =>
                      setInputs((p) => ({ ...p, [def.name]: e.target.checked }))
                    }
                  />
                ) : (
                  <input
                    type={def.type === "number" ? "number" : "text"}
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none"
                    value={
                      inputs[def.name] === undefined
                        ? ""
                        : String(inputs[def.name])
                    }
                    onChange={(e) =>
                      setInputs((p) => ({ ...p, [def.name]: e.target.value }))
                    }
                  />
                )}
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={mode === "dry" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setMode("dry")}
          >
            Dry run
          </Button>
          <Button
            type="button"
            variant={mode === "live" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setMode("live")}
          >
            Live run
          </Button>
          <Button
            type="button"
            className="ml-auto"
            size="sm"
            disabled={isRunning}
            onClick={runTest}
          >
            {isRunning ? "Running…" : "Run"}
          </Button>
        </div>

        {error && (
          <div
            className={cn(
              "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            )}
          >
            {error}
          </div>
        )}

        {result !== null && (
          <pre className="bg-muted text-muted-foreground max-h-[420px] overflow-auto rounded-lg p-4 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
