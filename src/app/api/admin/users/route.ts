import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin";
import { PLANS, type PlanTierName } from "@/lib/plans";

/**
 * Backoffice: lista todos los usuarios registrados con sus workspaces,
 * plan, cuota mensual (override o la del plan) y uso del mes corriente.
 */
export async function GET() {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return guard.error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      ownedWorkspaces: {
        select: {
          id: true,
          name: true,
          plan: true,
          billingPeriod: true,
          trialEndsAt: true,
          reportQuotaOverride: true,
          createdAt: true,
        },
      },
    },
  });

  // Reportes generados este mes por workspace (para mostrar uso vs cuota).
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const usage = await prisma.report.groupBy({
    by: ["workspaceId"],
    where: { createdAt: { gte: startOfMonth } },
    _count: { _all: true },
  });
  const usedByWs = new Map(usage.map((u) => [u.workspaceId, u._count._all]));

  const out = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isSuperAdmin:
      (u as unknown as { isSuperAdmin?: boolean }).isSuperAdmin === true,
    createdAt: u.createdAt,
    workspaces: u.ownedWorkspaces.map((w) => {
      const override = (w as unknown as { reportQuotaOverride?: number | null })
        .reportQuotaOverride;
      return {
        id: w.id,
        name: w.name,
        plan: w.plan,
        billingPeriod: w.billingPeriod,
        trialEndsAt: w.trialEndsAt,
        reportQuotaOverride: override ?? null,
        planQuota: PLANS[w.plan as PlanTierName]?.maxReportsPerMonth ?? null,
        usedThisMonth: usedByWs.get(w.id) ?? 0,
      };
    }),
  }));

  return NextResponse.json({ users: out });
}
