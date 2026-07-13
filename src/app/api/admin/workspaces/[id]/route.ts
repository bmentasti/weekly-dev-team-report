import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin";
import { parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import type { PlanTier } from "@prisma/client";

const patchSchema = z.object({
  plan: z.enum(["FREE", "TEAM", "PRO"]).optional(),
  /** Cuota mensual de reportes. null = volver a la del plan. */
  reportQuotaOverride: z.number().int().min(0).nullable().optional(),
});

/** Backoffice: edita plan y/o cuota mensual de un workspace. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return guard.error;

  const { data, error } = await parseBody(request, patchSchema);
  if (error) return error;

  const patch: Record<string, unknown> = {};
  if (data.plan) patch.plan = data.plan as PlanTier;
  if (data.reportQuotaOverride !== undefined)
    patch.reportQuotaOverride = data.reportQuotaOverride;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });

  const before = await prisma.workspace.findUnique({
    where: { id: params.id },
    select: { id: true, plan: true },
  });
  if (!before)
    return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });

  await prisma.workspace.update({ where: { id: params.id }, data: patch });

  await logAudit({
    workspaceId: params.id,
    actorId: guard.userId,
    actorName: guard.name ?? "admin",
    action: "admin.workspace.update",
    target: data.plan ?? undefined,
    meta: {
      via: "backoffice",
      fromPlan: before.plan,
      ...(data.plan ? { toPlan: data.plan } : {}),
      ...(data.reportQuotaOverride !== undefined
        ? { reportQuotaOverride: data.reportQuotaOverride }
        : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
