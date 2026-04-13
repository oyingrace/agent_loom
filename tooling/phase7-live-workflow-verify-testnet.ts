/**
 * Phase 7 live workflow testnet verifier.
 *
 * Covers:
 * - Paid `http` workflow step hybrid 402 flow (requires testnet payer funds)
 * - Optional: `soroban` / `soroban_batch` execution via the server hot wallet
 *
 * It is intentionally opinionated and designed for repeatable manual validation.
 *
 * Usage (repo root):
 *   pnpm tsx tooling/phase7-live-workflow-verify-testnet.ts
 *
 * Required env vars:
 *   - DATABASE_URL
 *   - WEB_APP_URL (default http://localhost:3000)
 *   - WORKFLOW_HOT_WALLET_SECRET (server-side soroban only; not required for paid http)
 *   - APP_SESSION_SECRET or SESSION_SECRET (iron-session for signing-in)
 *   - TESTNET_PAYER_SECRET (payer who submits the payment tx for the paid proxy)
 *
 * Optional env vars for Soroban validation:
 *   - SOROBAN_CONTRACT_ID (C...)
 *   - SOROBAN_FUNCTION (string)
 *   - SOROBAN_ARGS_JSON (json object of argsMapping; insertion order defines arg order)
 *   - SOROBAN_BATCH_JSON (json array of operations in the same format as soroban step ops)
 */

import { createHash, randomBytes } from "crypto";
import pg from "pg";
import { Keypair, Memo, TransactionBuilder, Operation, Asset, MemoType, Networks, Account, nativeToScVal, Address, xdr } from "@stellar/stellar-base";
import { Client } from "@modelcontextprotocol/sdk/client";
import { horizonFetchJson } from "../apps/web/lib/stellar/horizonFetch";
import { buildAuthMessage } from "../apps/web/lib/stellar/authMessage";
import { resolveExpression } from "@agent-loom/workflow";

type CookieJar = { cookieHeader?: string };
type XPaymentEvidence = { txHash: string; paymentNonce: string };

function sha256Base64Url(input: Buffer): string {
  return createHash("sha256").update(input).digest("base64url");
}

async function updateCookieJarFromResponse(res: Response, jar: CookieJar) {
  const getSetCookies = (res.headers as any).getSetCookie as
    | undefined
    | (() => string[]);
  const setCookies = getSetCookies?.() ?? [];
  if (!setCookies.length) {
    const raw = res.headers.get("set-cookie");
    if (raw) jar.cookieHeader = raw.split(";")[0];
    return;
  }
  jar.cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function fetchWithCookie(
  url: string,
  init: RequestInit,
  jar: CookieJar
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (jar.cookieHeader) headers.set("Cookie", jar.cookieHeader);
  const res = await fetch(url, { ...init, headers });
  await updateCookieJarFromResponse(res, jar);
  return res;
}

function parseJsonOrText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function submitTx(params: { xdr: string; horizonUrl: string }) {
  const res = await fetch(`${params.horizonUrl.replace(/\/$/, "")}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tx: params.xdr })
  });
  const json = await res.json().catch(async () => {
    const t = await res.text();
    return { raw: t };
  });
  if (!res.ok) {
    throw new Error(`Horizon tx submit failed (${res.status}): ${JSON.stringify(json)}`);
  }
  if (!json.hash) {
    throw new Error(`Horizon returned no hash: ${JSON.stringify(json)}`);
  }
  return json.hash as string;
}

async function main() {
  const webAppUrl = (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const mcpServerUrl = process.env.MCP_SERVER_URL ?? "http://localhost:3001"; // not used; kept for parity
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const payerSecret = process.env.TESTNET_PAYER_SECRET;
  if (!payerSecret) throw new Error("TESTNET_PAYER_SECRET is required");

  const horizonUrl = process.env.STELLAR_HORIZON_URL?.trim() ?? "https://horizon-testnet.stellar.org";

  const proxySlug = `verify-http-proxy-${Date.now()}`;
  const workflowSlug = `verify-http-workflow-${Date.now()}`;

  const payerKp = Keypair.fromSecret(payerSecret);
  const payerAddress = payerKp.publicKey();

  console.log("Phase 7 verify config:", { webAppUrl, databaseUrl, horizonUrl, payerAddress });

  // 1) Create an authenticated web session for DB ownership.
  const cookieJar: CookieJar = {};
  const userKp = Keypair.random();
  const userAccountAddress = userKp.publicKey();

  const nonceRes = await fetch(`${webAppUrl}/api/auth/nonce`);
  if (!nonceRes.ok) throw new Error(`GET /api/auth/nonce failed: ${nonceRes.status}`);
  const nonceBody = (await nonceRes.json()) as { nonce: string; domain: string };

  const message = buildAuthMessage({
    nonce: nonceBody.nonce,
    accountAddress: userAccountAddress,
    domain: nonceBody.domain
  });
  const signature = userKp.sign(Buffer.from(message, "utf8")).toString("base64");

  const sessionRes = await fetchWithCookie(
    `${webAppUrl}/api/auth/session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountAddress: userAccountAddress,
        nonce: nonceBody.nonce,
        signature
      })
    },
    cookieJar
  );
  if (!sessionRes.ok) throw new Error(`POST /api/auth/session failed: ${sessionRes.status}`);
  const sessionBody = (await sessionRes.json()) as { user: { id: string } };
  const userId = sessionBody.user.id;
  console.log("Authenticated user for ownership:", { userId });

  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();

  // 2) Seed a paid proxy and workflow template.
  const proxyRes = await db.query(
    `
    INSERT INTO api_proxies (
      owner_user_id, slug, name, target_url,
      encrypted_headers, input_schema, output_schema,
      pricing_asset, pricing_amount, payout_address,
      is_active
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id;
    `,
    [
      userId,
      proxySlug,
      "verify-paid-proxy",
      process.env.PROXY_TARGET_URL ?? "https://httpbin.org/get",
      null,
      null,
      null,
      "native",
      "1",
      payerAddress,
      true
    ]
  );
  const proxyId = proxyRes.rows[0].id as string;

  const workflowDef = {
    version: "1.0",
    inputVariables: [],
    steps: [
      {
        id: "http_step_1",
        name: "Paid HTTP step",
        type: "http",
        http: {
          proxyId,
          url: process.env.PROXY_TARGET_URL ?? "https://httpbin.org/get",
          method: "GET",
          bodyMapping: {}
        },
        outputAs: "paidHttpOut"
      }
    ],
    outputMapping: {
      upstream: "$.steps.paidHttpOut.output._message",
      proxyId: "$.steps.paidHttpOut.output.proxyId",
      paymentProofTxHash: "$.steps.paidHttpOut.output.txHash"
    }
  };

  const workflowRes = await db.query(
    `
    INSERT INTO workflow_templates (
      owner_user_id, name, description, workflow_definition, is_public
    )
    VALUES ($1,$2,$3,$4,$5)
    RETURNING id;
    `,
    [
      userId,
      workflowSlug,
      "verify live paid http workflow",
      JSON.stringify(workflowDef),
      false
    ]
  );
  const workflowId = workflowRes.rows[0].id as string;
  console.log("Seeded proxy + workflow:", { proxyId, workflowId });

  // 3) Call workflow live without x_payment to trigger 402.
  const liveBody = { inputs: {}, dryRun: false };
  const approvalRes = await fetch(`${webAppUrl}/api/workflows/${workflowId}/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieJar.cookieHeader ? { Cookie: cookieJar.cookieHeader } : {})
    },
    body: JSON.stringify(liveBody)
  });
  const approvalJson = await approvalRes.json().catch(async () => {
    const t = await approvalRes.text();
    return { raw: t };
  });
  if (approvalRes.status !== 402 || approvalJson?.error !== "approval_required") {
    throw new Error(
      `Expected 402 approval_required but got ${approvalRes.status}: ${JSON.stringify(approvalJson)}`
    );
  }

  const approval = approvalJson.approvalRequired as {
    kind?: string;
    stepId: string;
    proxyId?: string;
    paymentRequirements: any;
  };

  console.log("Received approval_required:", {
    stepId: approval.stepId,
    proxyId: approval.proxyId
  });

  const pr = approval.paymentRequirements as any;
  const paymentNonce = String(pr.paymentNonce);
  const asset = String(pr.stellar?.asset ?? "native");
  const amount = String(pr.stellar?.amount ?? "1");
  const destination = String(pr.stellar?.destination ?? payerAddress);

  // 4) Build + submit the payment tx on Stellar testnet.
  const acct = await horizonFetchJson<{ sequence: string }>(
    `/accounts/${encodeURIComponent(payerAddress)}`
  );
  const sequence = acct.sequence;
  const account = new Account(payerAddress, sequence);

  const networkPassphrase = process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
  const txBuilder = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase
  });
  txBuilder.addMemo(Memo.text(paymentNonce));

  let assetObj: any;
  if (asset === "native" || asset === "XLM") {
    assetObj = Asset.native();
  } else {
    const [code, issuer] = asset.split(":");
    if (!code || !issuer) throw new Error(`Invalid pricing asset in paymentRequirements: ${asset}`);
    assetObj = new Asset(code, issuer);
  }

  txBuilder.addOperation(
    Operation.payment({
      destination,
      asset: assetObj,
      amount
    })
  );

  const paymentTx = txBuilder.build();
  paymentTx.sign(payerKp);
  const txHash = await submitTx({ xdr: paymentTx.toXDR(), horizonUrl });
  console.log("Submitted payment:", { txHash, paymentNonce });

  // 5) Retry workflow with x_payment evidence.
  const x_payment: XPaymentEvidence = { txHash, paymentNonce };
  const retryRes = await fetch(`${webAppUrl}/api/workflows/${workflowId}/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieJar.cookieHeader ? { Cookie: cookieJar.cookieHeader } : {})
    },
    body: JSON.stringify({ inputs: {}, dryRun: false, x_payment })
  });

  const retryJson = await retryRes.json().catch(async () => {
    const t = await retryRes.text();
    return { raw: t };
  });

  if (!retryRes.ok || retryJson?.success !== true) {
    throw new Error(`Expected workflow live success but got ${retryRes.status}: ${JSON.stringify(retryJson)}`);
  }

  console.log("Live paid http workflow verification: PASS");

  // 6) Optional Soroban validation (best-effort).
  const contractId = process.env.SOROBAN_CONTRACT_ID;
  const functionName = process.env.SOROBAN_FUNCTION;
  const argsJson = process.env.SOROBAN_ARGS_JSON;
  if (contractId && functionName && argsJson) {
    const argsMapping = JSON.parse(argsJson) as Record<string, unknown>;
    const sorobanDef = {
      version: "1.0",
      inputVariables: [],
      steps: [
        {
          id: "soroban_step_1",
          name: "Soroban contract call",
          type: "soroban",
          soroban: {
            contractId,
            function: functionName,
            argsMapping
          },
          outputAs: "sorOut"
        }
      ],
      outputMapping: {
        txHash: "$.steps.sorOut.output.txHash"
      }
    };

    const sorobanWorkflowRes = await db.query(
      `
      INSERT INTO workflow_templates (
        owner_user_id, name, description, workflow_definition, is_public
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id;
      `,
      [
        userId,
        `soroban-verify-${Date.now()}`,
        "verify live soroban workflow",
        JSON.stringify(sorobanDef),
        false
      ]
    );
    const sorobanWorkflowId = sorobanWorkflowRes.rows[0].id as string;

    const sorRes = await fetch(`${webAppUrl}/api/workflows/${sorobanWorkflowId}/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieJar.cookieHeader ? { Cookie: cookieJar.cookieHeader } : {})
      },
      body: JSON.stringify({ inputs: {}, dryRun: false })
    });
    const sorJson = await sorRes.json().catch(async () => {
      const t = await sorRes.text();
      return { raw: t };
    });

    if (!sorRes.ok || sorJson?.success !== true) {
      console.warn("Optional Soroban verification failed:", { status: sorRes.status, sorJson });
    } else {
      console.log("Optional Soroban verification:", sorJson);
    }
  }

  console.log("Phase 7 testnet verification script finished.");
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

