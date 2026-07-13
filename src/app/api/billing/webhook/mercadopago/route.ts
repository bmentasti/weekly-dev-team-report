import { NextResponse } from "next/server";
import {
  applyPaidPlan,
  fetchMercadoPagoPayment,
  parsePlanReference,
  verifyMercadoPagoSignature,
} from "@/lib/billing";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Webhook de Mercado Pago: ÚNICO lugar que aplica un upgrade pago desde MP. (SEC-03)
 * 1) Verifica la firma HMAC (x-signature) con MP_WEBHOOK_SECRET.
 * 2) Consulta el estado real del pago en la API de MP (no confía en el body).
 * 3) Sólo si status === "approved" aplica el plan usando external_reference.
 */
export async function POST(request: Request) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    // Sin secreto configurado no procesamos webhooks (fail closed).
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const url = new URL(request.url);
  const dataId =
    url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const ok = verifyMercadoPagoSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secret,
  });
  if (!ok) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  if (!dataId) return NextResponse.json({ ok: true }); // nada que procesar

  const payment = await fetchMercadoPagoPayment(dataId);
  if (!payment) return NextResponse.json({ ok: true }); // no encontrado / ignorar

  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true, ignored: payment.status });
  }

  const ref = parsePlanReference(payment.externalReference);
  if (!ref) return NextResponse.json({ ok: true, ignored: "sin referencia" });

  const applied = await applyPaidPlan(ref);
  if (applied) {
    await logAudit({
      workspaceId: ref.workspaceId,
      actorId: "system:mercadopago",
      actorName: "Mercado Pago",
      action: "plan.change",
      target: ref.plan,
      meta: { period: ref.period, via: "webhook" },
    });
  }
  return NextResponse.json({ ok: true, applied });
}
