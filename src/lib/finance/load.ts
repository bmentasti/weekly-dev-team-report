// Loader server-only: traduce los modelos Prisma del proyecto a EngineInputs y
// devuelve el snapshot financiero calculado. Agrega costos/ingresos por
// naturaleza y tipo, deriva burn rate reciente y avance por combinación
// ponderada. NUNCA inventa datos: lo ausente queda null.
//
// NOTA: el Prisma Client se tipa con los nuevos modelos recién tras
// `prisma db:generate`. En este archivo accedemos a los delegates financieros
// mediante un facade tipado mínimo para no bloquear el type-check antes de
// regenerar el client.

import { prisma } from "@/lib/prisma";
import { computeFinancialSnapshot, type FinancialSnapshot } from "./engine";
import type { ContractModality } from "./types";
import { weightedProgress, type MilestoneProgress } from "./progress";

const db = prisma as any;

function num(v: unknown): number | null {
  if (v == null) return null;
  // Prisma Decimal, number o string numérico.
  const n = typeof v === "object" && v !== null && "toNumber" in (v as object)
    ? (v as { toNumber: () => number }).toNumber()
    : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function sumCost(projectId: string, nature: string): Promise<number | null> {
  const r = await db.costEntry.aggregate({
    where: { projectId, nature },
    _sum: { amount: true },
  });
  return num(r?._sum?.amount);
}

async function sumRevenue(projectId: string, type: string): Promise<number | null> {
  const r = await db.revenueEntry.aggregate({
    where: { projectId, type },
    _sum: { amount: true },
  });
  return num(r?._sum?.amount);
}

async function sumCostWhere(where: Record<string, unknown>): Promise<number | null> {
  const r = await db.costEntry.aggregate({ where, _sum: { amount: true } });
  return num(r?._sum?.amount);
}

/** Crecimiento de alcance desde BudgetChange (scope/change requests), separado
 * por aprobación. Usa `amount` como valor económico del cambio. */
async function scopeDelta(projectId: string): Promise<{ approved: number; unapproved: number }> {
  const rows: Array<{ type: string; amount: unknown; approved: boolean }> = await db.budgetChange.findMany({
    where: { projectId, type: { in: ["SCOPE_CHANGE", "CHANGE_REQUEST"] } },
    select: { type: true, amount: true, approved: true },
  });
  let approved = 0;
  let unapproved = 0;
  for (const row of rows) {
    const a = num(row.amount);
    if (a == null || a <= 0) continue;
    if (row.approved) approved += a;
    else unapproved += a;
  }
  return { approved, unapproved };
}

async function recentBurnPerDay(projectId: string, asOf: Date): Promise<number | null> {
  const from = new Date(asOf.getTime() - 30 * 24 * 60 * 60 * 1000);
  const r = await db.costEntry.aggregate({
    where: { projectId, nature: "ACTUAL", incurredOn: { gte: from, lte: asOf } },
    _sum: { amount: true },
  });
  const total = num(r?._sum?.amount);
  return total == null ? null : total / 30;
}

async function budgetDelta(projectId: string): Promise<{ inc: number; red: number }> {
  const rows: Array<{ type: string; amount: unknown }> = await db.budgetChange.findMany({
    where: { projectId, approved: true },
    select: { type: true, amount: true },
  });
  let inc = 0;
  let red = 0;
  for (const row of rows) {
    const a = num(row.amount);
    if (a == null) continue;
    if (row.type === "BUDGET_REDUCTION" || a < 0) red += Math.abs(a);
    else if (row.type === "BUDGET_INCREASE" || row.type === "CHANGE_REQUEST") inc += a;
  }
  return { inc, red };
}

/** Avance físico por combinación ponderada (milestones + manual + story points). */
async function resolveProgress(
  projectId: string,
  progressConfig: Record<string, unknown> | null,
): Promise<number | null> {
  const msRows: Array<{ name: string; weight: unknown; percentComplete: unknown; value: unknown }> =
    await db.financeMilestone.findMany({
      where: { projectId },
      select: { name: true, weight: true, percentComplete: true, value: true },
    });
  const milestones: MilestoneProgress[] = msRows
    .map((m) => ({
      key: m.name,
      weight: num(m.weight) ?? num(m.value) ?? 0,
      percentComplete: num(m.percentComplete) ?? 0,
    }))
    .filter((m) => m.weight > 0);

  const manualPct =
    progressConfig && typeof progressConfig.manualPct === "number"
      ? (progressConfig.manualPct as number)
      : null;

  // Story points desde el último reporte del proyecto, si existe.
  let sp: { completedPoints: number | null; totalPoints: number | null } | undefined;
  const lastReport = await db.report.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { metrics: true },
  });
  const pp = lastReport?.metrics?.projectProgress;
  if (pp && (typeof pp.completedPoints === "number" || typeof pp.totalPoints === "number")) {
    sp = { completedPoints: num(pp.completedPoints), totalPoints: num(pp.totalPoints) };
  }

  const cfg =
    progressConfig && typeof progressConfig === "object"
      ? {
          storyPointsWeight: num((progressConfig as Record<string, unknown>).storyPointsWeight) ?? undefined,
          milestoneWeight: num((progressConfig as Record<string, unknown>).milestoneWeight) ?? undefined,
          manualWeight: num((progressConfig as Record<string, unknown>).manualWeight) ?? undefined,
        }
      : undefined;

  const result = weightedProgress({
    storyPoints: sp,
    milestones: milestones.length ? milestones : undefined,
    manual: manualPct != null ? { percentComplete: manualPct } : undefined,
    config: cfg,
  });
  return result.completionPct;
}

/**
 * Carga el snapshot financiero del proyecto. Devuelve null si el proyecto no
 * tiene configuración financiera (aún no inicializado).
 */
export async function loadFinancialSnapshot(
  projectId: string,
  asOf: Date = new Date(),
): Promise<{ snapshot: FinancialSnapshot; configured: boolean } | null> {
  const cfg = await db.projectFinance.findUnique({ where: { projectId } });
  if (!cfg) return null;

  const baseline = await db.financeBaseline.findUnique({ where: { projectId } });
  const [actualCost, committedCosts, recognizedRevenue, contractedFromEntries, crRev, bonusRev, penaltyRev] =
    await Promise.all([
      sumCost(projectId, "ACTUAL"),
      sumCost(projectId, "COMMITTED"),
      sumRevenue(projectId, "RECOGNIZED"),
      sumRevenue(projectId, "CONTRACTED"),
      sumRevenue(projectId, "CHANGE_REQUEST"),
      sumRevenue(projectId, "BONUS"),
      sumRevenue(projectId, "PENALTY"),
    ]);
  const { inc, red } = await budgetDelta(projectId);
  const burn = await recentBurnPerDay(projectId, asOf);
  const completionPct = await resolveProgress(projectId, cfg.progressConfig ?? null);

  // ---- Riesgos operativos (§15–17) ----
  const [reworkCost, laborActual, blockerActual, blockerCommitted, blockerPotential] = await Promise.all([
    sumCostWhere({ projectId, category: "REWORK", nature: "ACTUAL" }),
    sumCostWhere({ projectId, category: "LABOR", nature: "ACTUAL" }),
    sumCostWhere({ projectId, category: "BLOCKER", nature: "ACTUAL" }),
    sumCostWhere({ projectId, category: "BLOCKER", nature: "COMMITTED" }),
    sumCostWhere({ projectId, category: "BLOCKER", nature: "POTENTIAL" }),
  ]);
  const totalLaborCost =
    laborActual == null && reworkCost == null ? null : (laborActual ?? 0) + (reworkCost ?? 0);
  const scope = await scopeDelta(projectId);

  // Forecast vigente (override de EAC / ingreso proyectado), si existe.
  const forecast = await db.forecastVersion.findFirst({
    where: { projectId, isCurrent: true },
    orderBy: { version: "desc" },
  });

  const snapshot = computeFinancialSnapshot({
    modality: (cfg.modality ?? "FIXED_PRICE") as ContractModality,
    currency: cfg.currency ?? "USD",
    asOf,
    startDate: cfg.startDate ?? null,
    plannedEndDate: cfg.plannedEndDate ?? null,
    contractualEndDate: cfg.contractualEndDate ?? null,
    forecastEndDate: (forecast?.forecastEndDate ?? cfg.forecastEndDate) ?? null,
    originalBudget: num(cfg.originalCostBudget),
    approvedBudgetIncreases: inc,
    approvedBudgetReductions: red,
    actualCost,
    committedCosts,
    contractedRevenue: num(cfg.contractedRevenue) ?? contractedFromEntries,
    recognizedRevenue,
    changeRequestRevenue: crRev,
    bonuses: bonusRev,
    penalties: penaltyRev,
    penaltiesReduceRevenue: true,
    projectedTotalRevenue: num(forecast?.projectedRevenue),
    targetMarginPct: num(cfg.targetMarginPct),
    completionPct,
    burnRatePerDay: burn,
    workingDaysPerWeek: typeof cfg.workingDaysPerWeek === "number" ? cfg.workingDaysPerWeek : 5,
    bottomUpEtc: forecast ? num(forecast.estimatedCost) : null,
    hasBottomUpEtc: !!forecast && num(forecast.estimatedCost) != null,
    baselineEstimatedCost: baseline ? num(baseline.estimatedCost) : null,
    // Riesgos operativos
    originalScopeValue: baseline ? num(baseline.scopeValue) : null,
    approvedAddedScopeValue: scope.approved,
    unapprovedAddedScopeValue: scope.unapproved,
    reworkCost,
    totalLaborCost,
    blockerActualCost: blockerActual,
    blockerCommittedCost: blockerCommitted,
    blockerPotentialCost: blockerPotential,
  });

  return { snapshot, configured: true };
}
