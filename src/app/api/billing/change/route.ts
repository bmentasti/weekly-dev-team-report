import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceForUser } from "@/lib/workspace";
import { parseBody } from "@/lib/api";
import { planChangeSchema } from "@/lib/validations";
import { PLANS, type PlanTierName } from "@/lib/plans";
import { logAudit } from "@/lib/audit";
import type { BillingPeriod, PlanTier } from "@prisma/client";

/**
 * Cambio de plan. Reglas de seguridad (H1):
 *  - Solo el dueño del workspace.
 *  - Downgrade o quedarse igual (precio menor o igual) se aplica directo.
 *  - UPGRADE a un plan pago NO se aplica acá: debe pasar por el checkout con
 *    pago verificado (/api/billing/checkout). El único atajo es un flag de
 *    desarrollo explícito (ALLOW_DEV_PLAN_CHANGE), apagado por defecto.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await parseBody(request, planChangeSchema);
  if (error) return error;
  const { plan, period } = data;

  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace)
    return NextResponse.json({ error: "No tenés un workspace." }, { status: 400 });
  if (workspace.ownerId !== session.user.id)
    return NextResponse.json(
      { error: "Solo el dueño del workspace puede cambiar el plan." },
      { status: 403 },
    );

  const current = workspace.plan as PlanTierName;
  const isUpgrade = PLANS[plan].monthly > PLANS[current].monthly;
  const devOverride = process.env.ALLOW_DEV_PLAN_CHANGE === "true";

  if (isUpgrade && !devOverride) {
    // El upgrade a un plan pago requiere pago verificado (checkout).
    return NextResponse.json(
      {
        error: "El cambio a un plan pago requiere completar el pago.",
        requiresCheckout: true,
      },
      { status: 402 },
    );
  }

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { plan: plan as PlanTier, billingPeriod: period as BillingPeriod },
  });

  await logAudit({
    workspaceId: workspace.id,
    actorId: session.user.id,
    actorName: session.user.name,
    action: "plan.change",
    target: plan,
    meta: { from: current, to: plan, period },
  });

  return NextResponse.json({ ok: true, plan, period, dev: devOverride });
}
