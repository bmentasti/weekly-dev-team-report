import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canFinance } from "@/lib/finance/access";
import { loadFinancialSnapshot } from "@/lib/finance/load";
import { logAudit } from "@/lib/audit";
import type { FinancialSnapshot } from "@/lib/finance/engine";

const db = prisma as any;

const MODALITIES = [
  "FIXED_PRICE",
  "TIME_AND_MATERIALS",
  "MANAGED_CAPACITY",
  "MILESTONE_BASED",
  "RETAINER",
  "HYBRID",
] as const;

const configSchema = z.object({
  modality: z.enum(MODALITIES).optional(),
  currency: z.string().min(1).max(8).optional(),
  trackingLevel: z.enum(["NONE", "BASIC", "FULL"]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  plannedEndDate: z.string().datetime().nullable().optional(),
  contractualEndDate: z.string().datetime().nullable().optional(),
  forecastEndDate: z.string().datetime().nullable().optional(),
  contractedRevenue: z.number().finite().nullable().optional(),
  maxAuthorizedRevenue: z.number().finite().nullable().optional(),
  originalCostBudget: z.number().finite().nullable().optional(),
  contingency: z.number().finite().nullable().optional(),
  targetMarginPct: z.number().min(0).max(100).nullable().optional(),
  progressConfig: z.record(z.unknown()).nullable().optional(),
  workingDaysPerWeek: z.number().int().min(1).max(7).optional(),
});

/** Oculta márgenes/rentabilidad si el usuario no tiene viewMargins. */
function maskMargins(s: FinancialSnapshot): FinancialSnapshot {
  return {
    ...s,
    profitability: {
      ...s.profitability,
      currentMarginPct: hide(s.profitability.currentMarginPct),
      projectedMarginPct: hide(s.profitability.projectedMarginPct),
      currentProfit: hide(s.profitability.currentProfit),
      projectedProfit: hide(s.profitability.projectedProfit),
      projectedLoss: hide(s.profitability.projectedLoss),
      baselineExpectedProfit: hide(s.profitability.baselineExpectedProfit),
      marginVariance: hide(s.profitability.marginVariance),
    },
  };
}
function hide<T extends { value: unknown; provenance: any }>(m: T): T {
  return {
    ...m,
    value: null,
    insufficientData: true,
    provenance: { ...m.provenance, source: "Restringido por permisos" },
  } as T;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canFinance(session.user.id, params.id, "viewFinancials")))
    return NextResponse.json(
      { error: "Tu rol no permite ver las finanzas de este proyecto." },
      { status: 403 },
    );

  const result = await loadFinancialSnapshot(params.id);
  if (!result)
    return NextResponse.json({ configured: false, snapshot: null });

  const canMargins = await canFinance(session.user.id, params.id, "viewMargins");
  const snapshot = canMargins ? result.snapshot : maskMargins(result.snapshot);
  return NextResponse.json({ configured: true, canViewMargins: canMargins, snapshot });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canFinance(session.user.id, params.id, "editFinancials")))
    return NextResponse.json(
      { error: "Tu rol no permite configurar las finanzas de este proyecto." },
      { status: 403 },
    );

  const parsed = configSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );

  const d = parsed.data;
  const data: Record<string, unknown> = {};
  const dateFields = ["startDate", "plannedEndDate", "contractualEndDate", "forecastEndDate"] as const;
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue;
    if ((dateFields as readonly string[]).includes(k)) {
      data[k] = v === null ? null : new Date(v as string);
    } else {
      data[k] = v;
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { workspaceId: true },
  });
  if (!project)
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const saved = await db.projectFinance.upsert({
    where: { projectId: params.id },
    create: { projectId: params.id, ...data },
    update: data,
  });

  await logAudit({
    workspaceId: project.workspaceId,
    actorId: session.user.id,
    actorName: session.user.name ?? null,
    action: "finance.config.update",
    target: params.id,
    meta: { fields: Object.keys(data) },
  });

  return NextResponse.json({ ok: true, config: { id: saved.id, projectId: params.id } });
}
