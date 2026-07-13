import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PLANS, type PlanTierName } from "@/lib/plans";
import type { BillingPeriod, PlanTier } from "@prisma/client";
import { safeFetch } from "@/lib/http";

/**
 * Utilidades de billing compartidas por checkout y webhooks.
 *
 * REGLA DE ORO (SEC-03): el plan pago SÓLO se aplica desde un webhook verificado
 * del proveedor (Mercado Pago / PayPal). El checkout únicamente crea la
 * preferencia/orden y redirige; nunca marca el upgrade como pagado.
 */

export interface PlanReference {
  workspaceId: string;
  plan: PlanTierName;
  period: "MONTHLY" | "ANNUAL";
}

/** Parsea el `external_reference`/`custom_id` con forma `workspace:plan:period`. */
export function parsePlanReference(raw: string | null | undefined): PlanReference | null {
  if (!raw) return null;
  const [workspaceId, plan, period] = raw.split(":");
  if (!workspaceId || !plan || !period) return null;
  if (!(plan in PLANS)) return null;
  if (period !== "MONTHLY" && period !== "ANNUAL") return null;
  return { workspaceId, plan: plan as PlanTierName, period };
}

/**
 * Aplica el plan pagado a un workspace. Idempotente: si ya está en ese plan/period
 * no hace nada. Debe llamarse SÓLO tras confirmar el pago server-side.
 */
export async function applyPaidPlan(ref: PlanReference): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({
    where: { id: ref.workspaceId },
    select: { id: true, plan: true, billingPeriod: true },
  });
  if (!ws) return false;
  if (ws.plan === (ref.plan as PlanTier) && ws.billingPeriod === (ref.period as BillingPeriod))
    return true; // idempotente
  await prisma.workspace.update({
    where: { id: ref.workspaceId },
    data: {
      plan: ref.plan as PlanTier,
      billingPeriod: ref.period as BillingPeriod,
    },
  });
  return true;
}

/**
 * Verifica la firma HMAC de un webhook de Mercado Pago.
 * MP envía `x-signature: ts=<ts>,v1=<hash>` y `x-request-id`. El manifest es
 * `id:<dataId>;request-id:<reqId>;ts:<ts>;` firmado con HMAC-SHA256(secret).
 */
export function verifyMercadoPagoSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = opts;
  if (!signatureHeader || !dataId) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as { ts?: string; v1?: string };
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${parts.ts};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");
  return timingSafeEqualHex(expected, parts.v1);
}

/** Consulta el estado real de un pago en Mercado Pago (no confiar en el body). */
export async function fetchMercadoPagoPayment(paymentId: string): Promise<{
  status: string;
  externalReference: string | null;
} | null> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return null;
  const res = await safeFetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    external_reference?: string;
  };
  return {
    status: data.status ?? "unknown",
    externalReference: data.external_reference ?? null,
  };
}

/** Base URL de la API de PayPal según entorno. */
export function paypalBase(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/** Access token client-credentials de PayPal. */
export async function paypalAccessToken(): Promise<string | null> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return null;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await safeFetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/**
 * Verifica la firma de un webhook de PayPal contra su API
 * (`/v1/notifications/verify-webhook-signature`). Requiere PAYPAL_WEBHOOK_ID.
 */
export async function verifyPaypalSignature(
  headers: Headers,
  rawBody: string,
  accessToken: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const res = await safeFetch(
    `${paypalBase()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}
