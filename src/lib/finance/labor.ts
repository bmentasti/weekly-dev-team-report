// Costo laboral con tarifas VERSIONADAS. Un cambio de tarifa nunca reescribe el
// pasado: cada tramo de trabajo se valúa con la tarifa vigente en su fecha
// (§6, §7, caso de prueba 11).

import { isNum, mul, sumPresent, round } from "./money";

export interface RatePeriod {
  key: string; // personKey | rol | team | "*"
  internalCostPerHour?: number | null;
  sellRatePerHour?: number | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null; // exclusivo; null = vigente
}

/** Devuelve la tarifa vigente para `key` en `date` (mayor effectiveFrom ≤ date). */
export function resolveRateAt(
  rates: RatePeriod[],
  key: string,
  date: Date,
): RatePeriod | null {
  const applicable = rates
    .filter((r) => r.key === key)
    .filter((r) => r.effectiveFrom.getTime() <= date.getTime())
    .filter((r) => r.effectiveTo == null || date.getTime() < r.effectiveTo.getTime())
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return applicable[0] ?? null;
}

export interface WorkSegment {
  key: string;
  hours: number;
  date: Date; // fecha del trabajo, define qué tarifa aplica
}

/**
 * Costo laboral interno total sobre tramos de trabajo, aplicando la tarifa
 * histórica correspondiente a cada tramo. Los tramos sin tarifa resoluble se
 * reportan aparte (no se asume costo 0).
 */
export function laborCost(
  rates: RatePeriod[],
  segments: WorkSegment[],
): { internalCost: number; sellValue: number; unresolved: WorkSegment[] } {
  const costs: (number | null)[] = [];
  const sells: (number | null)[] = [];
  const unresolved: WorkSegment[] = [];
  for (const seg of segments) {
    const rate = resolveRateAt(rates, seg.key, seg.date);
    if (!rate || !isNum(rate.internalCostPerHour)) {
      unresolved.push(seg);
      continue;
    }
    costs.push(mul(seg.hours, rate.internalCostPerHour));
    if (isNum(rate.sellRatePerHour)) sells.push(mul(seg.hours, rate.sellRatePerHour));
  }
  return {
    internalCost: round(sumPresent(costs)) ?? 0,
    sellValue: round(sumPresent(sells)) ?? 0,
    unresolved,
  };
}
