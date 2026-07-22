// Impacto económico de atrasos (§11) y días de atraso absorbibles.
// El costo incremental de atraso puede ser negativo (si el atraso genera
// ingreso facturable neto), en cuyo caso NO hay punto de pérdida por tiempo.

import { isNum, add, sub, mul, round } from "./money";

export interface DelayCostResult {
  incrementalDailyDelayCost: number | null;
  incrementalWeeklyDelayCost: number | null;
  formula: string;
  note?: string;
}

/**
 * Costo incremental por día de atraso:
 *   costo equipo + infra + proveedores + indirectos + penalidades/día
 *   − ingreso adicional facturable/día − costos evitables/día
 */
export function incrementalDailyDelayCost(args: {
  dailyTeamCost?: number | null;
  dailyInfraCost?: number | null;
  dailyVendorCost?: number | null;
  dailyIndirectCost?: number | null;
  dailyPenalty?: number | null;
  dailyBillableRevenue?: number | null; // validado como facturable/aprobado
  dailyAvoidableCost?: number | null;
  workingDaysPerWeek?: number;
}): DelayCostResult {
  const costs = [
    args.dailyTeamCost,
    args.dailyInfraCost,
    args.dailyVendorCost,
    args.dailyIndirectCost,
    args.dailyPenalty,
  ];
  // Necesitamos al menos el costo de equipo para tener sentido.
  if (!isNum(args.dailyTeamCost)) {
    return {
      incrementalDailyDelayCost: null,
      incrementalWeeklyDelayCost: null,
      formula:
        "daily = teamCost + infra + vendors + indirect + penalty − billableRevenue − avoidableCost",
      note: "Falta el costo diario del equipo: información insuficiente.",
    };
  }
  const gross = costs.reduce<number>((s, c) => s + (isNum(c) ? c : 0), 0);
  const billable = isNum(args.dailyBillableRevenue) ? args.dailyBillableRevenue : 0;
  const avoidable = isNum(args.dailyAvoidableCost) ? args.dailyAvoidableCost : 0;
  const daily = round(gross - billable - avoidable);
  const wdpw = args.workingDaysPerWeek ?? 5;
  const weekly = mul(daily, wdpw);
  return {
    incrementalDailyDelayCost: daily,
    incrementalWeeklyDelayCost: weekly,
    formula:
      "daily = teamCost + infra + vendors + indirect + penalty − billableRevenue − avoidableCost",
    note:
      isNum(daily) && daily <= 0
        ? "El atraso no genera pérdida diaria (ingreso facturable ≥ costos incrementales)."
        : undefined,
  };
}

/** Costo total del atraso = costo diario incremental × días de atraso. */
export function delayCost(args: {
  incrementalDailyDelayCost?: number | null;
  delayDays?: number | null;
}): number | null {
  return mul(args.incrementalDailyDelayCost, args.delayDays);
}

/**
 * Días máximos de atraso antes de entrar en pérdida:
 *   breakEvenDelayDays = currentProjectedProfit / incrementalDailyDelayCost
 * Sólo si el costo diario es POSITIVO (si es ≤ 0, el atraso no genera pérdida).
 */
export function breakEvenDelayDays(args: {
  currentProjectedProfit?: number | null;
  incrementalDailyDelayCost?: number | null;
}): { days: number | null; note: string } {
  const { currentProjectedProfit: p, incrementalDailyDelayCost: d } = args;
  if (!isNum(p) || !isNum(d)) {
    return { days: null, note: "Información insuficiente para calcular días absorbibles." };
  }
  if (d <= 0) {
    return {
      days: null,
      note: "El costo incremental diario no es positivo: el proyecto no pierde por atrasarse.",
    };
  }
  if (p <= 0) {
    return { days: 0, note: "La ganancia proyectada ya es ≤ 0: no absorbe atraso adicional." };
  }
  return {
    days: round(p / d, 1),
    note: "Días de atraso que mantiene ganancia ≥ 0 al ritmo de costo incremental actual.",
  };
}

/** Ganancia proyectada tras N días de atraso. */
export function delayedProjectedProfit(args: {
  currentProjectedProfit?: number | null;
  incrementalDailyDelayCost?: number | null;
  delayDays?: number | null;
  extraBillableRevenue?: number | null; // ingreso facturable adicional validado
  extraPenalties?: number | null;
}): number | null {
  const base = args.currentProjectedProfit;
  const cost = delayCost({
    incrementalDailyDelayCost: args.incrementalDailyDelayCost,
    delayDays: args.delayDays,
  });
  if (!isNum(base) || !isNum(cost)) return null;
  const extra = isNum(args.extraBillableRevenue) ? args.extraBillableRevenue : 0;
  const pen = isNum(args.extraPenalties) ? args.extraPenalties : 0;
  return round(base - cost + extra - pen);
}
