import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceForUser } from "@/lib/workspace";
import { PLANS, annualTotal, type PlanTierName } from "@/lib/plans";
import { parseBody } from "@/lib/api";
import { checkoutSchema } from "@/lib/validations";
import type { BillingPeriod, PlanTier } from "@prisma/client";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await parseBody(request, checkoutSchema);
  if (error) return error;
  const plan = data.plan as PlanTierName;
  const period = data.period as "ANNUAL" | "MONTHLY";
  const provider = data.provider ?? "";

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "No tenés un workspace." }, { status: 400 });
  if (workspace.ownerId !== session.user.id)
    return NextResponse.json(
      { error: "Solo el dueño puede cambiar el plan." },
      { status: 403 },
    );

  const def = PLANS[plan];
  const amount =
    period === "ANNUAL" ? annualTotal(def.monthly) : def.monthly;
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Free (o downgrade) no requiere pago.
  if (amount === 0) {
    await applyPlan(workspace.id, plan, period);
    return NextResponse.json({ ok: true, dev: true });
  }

  const reference = `${workspace.id}:${plan}:${period}`;

  try {
    if (provider === "mercadopago" && process.env.MP_ACCESS_TOKEN) {
      const res = await fetch(
        "https://api.mercadopago.com/checkout/preferences",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: [
              {
                title: `DevMetrics ${def.name} (${period === "ANNUAL" ? "anual" : "mensual"})`,
                quantity: 1,
                unit_price: amount,
                currency_id: "USD",
              },
            ],
            back_urls: {
              success: `${appUrl}/settings?paid=1`,
              failure: `${appUrl}/settings?paid=0`,
            },
            auto_return: "approved",
            external_reference: reference,
          }),
        },
      );
      const data = (await res.json()) as { init_point?: string };
      if (data.init_point)
        return NextResponse.json({ redirectUrl: data.init_point });
      return NextResponse.json(
        { error: "No se pudo crear el pago en Mercado Pago." },
        { status: 502 },
      );
    }

    if (
      provider === "paypal" &&
      process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET
    ) {
      const base =
        process.env.PAYPAL_ENV === "live"
          ? "https://api-m.paypal.com"
          : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
      ).toString("base64");
      const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      const tokenData = (await tokenRes.json()) as { access_token?: string };
      if (!tokenData.access_token)
        return NextResponse.json({ error: "PayPal auth falló." }, { status: 502 });

      const orderRes = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: { currency_code: "USD", value: String(amount) },
              custom_id: reference,
            },
          ],
          application_context: {
            return_url: `${appUrl}/settings?paid=1`,
            cancel_url: `${appUrl}/settings?paid=0`,
          },
        }),
      });
      const order = (await orderRes.json()) as {
        links?: { rel: string; href: string }[];
      };
      const approve = order.links?.find((l) => l.rel === "approve")?.href;
      if (approve) return NextResponse.json({ redirectUrl: approve });
      return NextResponse.json(
        { error: "No se pudo crear la orden de PayPal." },
        { status: 502 },
      );
    }

    // Sin credenciales del proveedor: en producción NO se aplica el plan (el
    // upgrade real debe confirmarse por webhook/IPN verificado del proveedor).
    // Solo se aplica directo con un flag de desarrollo explícito. (H1)
    if (process.env.ALLOW_DEV_PLAN_CHANGE === "true") {
      await applyPlan(workspace.id, plan, period);
      return NextResponse.json({ ok: true, dev: true });
    }
    return NextResponse.json(
      {
        error:
          "No hay proveedor de pago configurado. Configurá Mercado Pago o PayPal para cobrar upgrades.",
        requiresProvider: true,
      },
      { status: 402 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error en el checkout." },
      { status: 500 },
    );
  }
}

async function applyPlan(
  workspaceId: string,
  plan: PlanTierName,
  period: "MONTHLY" | "ANNUAL",
) {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { plan: plan as PlanTier, billingPeriod: period as BillingPeriod },
  });
}
