import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canFinance } from "@/lib/finance/access";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

const schema = z.object({
  contractedRevenue: z.number().finite().nullable().optional(),
  estimatedCost: z.number().finite().nullable().optional(),
  scopeValue: z.number().finite().nullable().optional(),
  estimatedHours: z.number().finite().nullable().optional(),
  estimatedStoryPoints: z.number().finite().nullable().optional(),
  estimatedDurationDays: z.number().int().nullable().optional(),
  targetMarginPct: z.number().min(0).max(100).nullable().optional(),
  plannedEndDate: z.string().datetime().nullable().optional(),
  plannedTeam: z.record(z.unknown()).nullable().optional(),
  reason: z.string().max(500).optional(),
});

/**
 * Captura la baseline ORIGINAL. Es inmutable: si ya existe, NO se sobrescribe
 * (se responde 409). Cambios posteriores deben ir por ForecastVersion/BudgetChange.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canFinance(session.user.id, params.id, "editFinancials")))
    return NextResponse.json({ error: "Sin permiso para editar finanzas." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const existing = await db.financeBaseline.findUnique({ where: { projectId: params.id } });
  if (existing)
    return NextResponse.json(
      { error: "La baseline original ya existe y es inmutable." },
      { status: 409 },
    );

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { workspaceId: true },
  });
  if (!project)
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const d = parsed.data;
  const created = await db.financeBaseline.create({
    data: {
      projectId: params.id,
      contractedRevenue: d.contractedRevenue ?? null,
      estimatedCost: d.estimatedCost ?? null,
      scopeValue: d.scopeValue ?? null,
      estimatedHours: d.estimatedHours ?? null,
      estimatedStoryPoints: d.estimatedStoryPoints ?? null,
      estimatedDurationDays: d.estimatedDurationDays ?? null,
      targetMarginPct: d.targetMarginPct ?? null,
      plannedEndDate: d.plannedEndDate ? new Date(d.plannedEndDate) : null,
      plannedTeam: d.plannedTeam ?? undefined,
      capturedById: session.user.id,
      capturedByName: session.user.name ?? null,
      reason: d.reason ?? null,
    },
  });

  await logAudit({
    workspaceId: project.workspaceId,
    actorId: session.user.id,
    actorName: session.user.name ?? null,
    action: "finance.baseline.capture",
    target: params.id,
  });

  return NextResponse.json({ ok: true, baselineId: created.id });
}
