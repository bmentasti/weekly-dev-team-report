import { NextResponse } from "next/server";
import {
  applyPaidPlan,
  parsePlanReference,
  paypalAccessToken,
  paypalBase,
  verifyPaypalSignature,
} from "@/lib/billing";
import { safeFetch } from "@/lib/http";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Webhook de PayPal: ÚNICO lugar que aplica un upgrade pago desde PayPal. (SEC-03)
 * 1) Verifica la firma del evento contra la API de PayPal (requiere PAYPAL_WEBHOOK_ID).
 * 2) En CHECKOUT.ORDER.APPROVED captura la orden.
 * 3) En PAYMENT.CAPTURE.COMPLETED aplica el plan usando custom_id (workspace:plan:period).
 */
export async function POST(request: Request) {
  if (!process.env.PAYPAL_WEBHOOK_ID)
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });

  const raw = await request.text();
  const accessToken = await paypalAccessToken();
  if (!accessToken)
    return NextResponse.json({ error: "PayPal auth falló" }, { status: 502 });

  const verified = await verifyPaypalSignature(request.headers, raw, accessToken);
  if (!verified)
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  let event: {
    event_type?: string;
    resource?: {
      id?: string;
      custom_id?: string;
      purchase_units?: { custom_id?: string }[];
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const type = event.event_type;

  // Orden aprobada por el comprador: capturamos el pago server-side.
  if (type === "CHECKOUT.ORDER.APPROVED" && event.resource?.id) {
    await safeFetch(
      `${paypalBase()}/v2/checkout/orders/${event.resource.id}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    ).catch(() => {});
    // El plan se aplica cuando llegue PAYMENT.CAPTURE.COMPLETED.
    return NextResponse.json({ ok: true, captured: true });
  }

  // Pago capturado: aplicar el plan.
  if (type === "PAYMENT.CAPTURE.COMPLETED") {
    const customId =
      event.resource?.custom_id ??
      event.resource?.purchase_units?.[0]?.custom_id ??
      null;
    const ref = parsePlanReference(customId);
    if (!ref) return NextResponse.json({ ok: true, ignored: "sin referencia" });
    const applied = await applyPaidPlan(ref);
    if (applied) {
      await logAudit({
        workspaceId: ref.workspaceId,
        actorId: "system:paypal",
        actorName: "PayPal",
        action: "plan.change",
        target: ref.plan,
        meta: { period: ref.period, via: "webhook" },
      });
    }
    return NextResponse.json({ ok: true, applied });
  }

  return NextResponse.json({ ok: true, ignored: type });
}
