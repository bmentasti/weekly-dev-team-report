// Presupuesto, consumo, burn rate, runway y fecha de agotamiento.
// Todas las funciones devuelven MetricResult con fórmula, insumos y confianza.

import { isNum, add, sub, div, pct, round } from "./money";
import { metric, type MetricResult } from "./types";

/** Presupuesto vigente = original + ampliaciones aprobadas − reducciones aprobadas. */
export function currentBudget(args: {
  originalBudget?: number | null;
  approvedBudgetIncreases?: number | null;
  approvedBudgetReductions?: number | null;
  source?: string;
}): MetricResult {
  const { originalBudget, approvedBudgetIncreases = 0, approvedBudgetReductions = 0 } = args;
  const value = isNum(originalBudget)
    ? round(
        originalBudget +
          (isNum(approvedBudgetIncreases) ? approvedBudgetIncreases : 0) -
          (isNum(approvedBudgetReductions) ? approvedBudgetReductions : 0),
      )
    : null;
  return metric(value, {
    formula: "currentBudget = originalBudget + approvedIncreases − approvedReductions",
    inputs: { originalBudget, approvedBudgetIncreases, approvedBudgetReductions },
    source: args.source ?? "Config presupuesto + ampliaciones aprobadas",
    confidence: isNum(originalBudget) ? "HIGH" : "NONE",
  });
}

/** Presupuesto disponible = vigente − costo real − costos comprometidos. */
export function remainingBudget(args: {
  currentBudget?: number | null;
  actualCost?: number | null;
  committedCosts?: number | null;
}): MetricResult {
  const { currentBudget: cb, actualCost, committedCosts = 0 } = args;
  const value =
    isNum(cb) && isNum(actualCost)
      ? round(cb - actualCost - (isNum(committedCosts) ? committedCosts : 0))
      : null;
  return metric(value, {
    formula: "remainingBudget = currentBudget − actualCost − committedCosts",
    inputs: { currentBudget: cb, actualCost, committedCosts },
    source: "Presupuesto vigente y costos (real + comprometido)",
    confidence: value === null ? "NONE" : "HIGH",
  });
}

/** % consumido = actualCost / currentBudget × 100. */
export function budgetConsumedPct(args: {
  actualCost?: number | null;
  currentBudget?: number | null;
}): MetricResult {
  const value = pct(args.actualCost, args.currentBudget);
  return metric(value, {
    formula: "budgetConsumed% = actualCost / currentBudget × 100",
    inputs: { actualCost: args.actualCost, currentBudget: args.currentBudget },
    source: "Costo real y presupuesto vigente",
    confidence: value === null ? "NONE" : "HIGH",
  });
}

export type BurnWindow = "weekly" | "monthly" | "recent30" | "average";

/**
 * Burn rate: costo por unidad de tiempo. Se calcula sobre costo acumulado y
 * días transcurridos (average) o sobre una ventana reciente si se provee.
 * Devuelve el gasto por DÍA calendario para poder derivar runway.
 */
export function burnRatePerDay(args: {
  costInWindow?: number | null;
  daysInWindow?: number | null;
  window?: BurnWindow;
}): MetricResult {
  const { costInWindow, daysInWindow, window = "average" } = args;
  const value = div(costInWindow, daysInWindow, 4);
  return metric(value, {
    formula: "burnRatePerDay = costInWindow / daysInWindow",
    inputs: { costInWindow, daysInWindow, window },
    source: `Burn rate (${window})`,
    confidence:
      value === null ? "NONE" : window === "recent30" || window === "monthly" ? "MEDIUM" : "MEDIUM",
  });
}

/**
 * Runway presupuestario en días = remainingBudget / burnRatePerDay.
 * No se calcula si el burn rate es 0, negativo o falta (regla §8).
 */
export function budgetRunwayDays(args: {
  remainingBudget?: number | null;
  burnRatePerDay?: number | null;
}): MetricResult {
  const { remainingBudget: rb, burnRatePerDay: burn } = args;
  const value = isNum(rb) && isNum(burn) && burn > 0 ? round(rb / burn, 1) : null;
  return metric(
    value,
    {
      formula: "budgetRunwayDays = remainingBudget / burnRatePerDay (burn > 0)",
      inputs: { remainingBudget: rb, burnRatePerDay: burn },
      source: "Presupuesto disponible y burn rate reciente",
      confidence: value === null ? "NONE" : "MEDIUM",
    },
    isNum(burn) && burn <= 0 ? "Burn rate no positivo: no se proyecta agotamiento." : undefined,
  );
}

/** Fecha estimada de agotamiento = asOf + runwayDays. Null si no hay runway. */
export function budgetExhaustionDate(args: {
  asOf: Date;
  runwayDays?: number | null;
}): { date: Date | null; insufficientData: boolean; provenance: MetricResult["provenance"] } {
  const { asOf, runwayDays } = args;
  const date =
    isNum(runwayDays) && runwayDays >= 0
      ? new Date(asOf.getTime() + runwayDays * 24 * 60 * 60 * 1000)
      : null;
  return {
    date,
    insufficientData: date === null,
    provenance: {
      formula: "exhaustionDate = asOf + runwayDays",
      inputs: { asOf: asOf.toISOString(), runwayDays: runwayDays ?? null },
      source: "Runway presupuestario",
      confidence: date === null ? "NONE" : "MEDIUM",
    },
  };
}

/** Ingreso adicional por change requests y bonos, neto de penalidades. */
export function additionalRevenue(args: {
  changeRequestRevenue?: number | null;
  bonuses?: number | null;
  penalties?: number | null;
  penaltiesReduceRevenue?: boolean; // true: penalidad baja ingreso; false: sube costo
}): MetricResult {
  const cr = isNum(args.changeRequestRevenue) ? args.changeRequestRevenue : 0;
  const bonus = isNum(args.bonuses) ? args.bonuses : 0;
  const pen = args.penaltiesReduceRevenue && isNum(args.penalties) ? args.penalties : 0;
  const value = add(cr, bonus, -pen);
  return metric(value, {
    formula: "additionalRevenue = changeRequests + bonuses − (penalties si aplican a ingreso)",
    inputs: { ...args, penaltiesReduceRevenue: args.penaltiesReduceRevenue ? 1 : 0 },
    source: "Change requests, bonos y penalidades",
    confidence: "MEDIUM",
  });
}
