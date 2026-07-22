// Evaluación de finalización anticipada (§10).
// NO asume que terminar antes siempre aumenta la rentabilidad: compara costos
// evitados y bonos contra ingresos que se dejan de facturar y costos de
// transición. El valor de capacidad liberada SOLO se suma si está validado.

import { isNum, add, sub, round } from "./money";

export type EarlyCompletionVerdict =
  | "INCREASES_PROFIT" // finalizar antes aumenta la rentabilidad
  | "REDUCES_COST_AND_REVENUE" // baja costos pero también ingresos
  | "IMMATERIAL" // no cambia materialmente el resultado
  | "INSUFFICIENT_DATA";

export interface EarlyCompletionResult {
  netBenefit: number | null;
  verdict: EarlyCompletionVerdict;
  breakdown: {
    avoidedCost: number | null;
    lostRevenue: number | null;
    earlyCompletionBonus: number | null;
    validatedReleasedCapacityValue: number | null;
    transitionCosts: number | null;
  };
  formula: string;
  explanation: string;
  assumptions: string[];
}

/**
 * @param plannedRemainingCost costo esperado de hoy a la fecha planificada
 * @param forecastRemainingCost costo esperado de hoy a la fecha anticipada
 * @param lostRevenue ingresos que se dejarían de facturar (0 en Fixed Price)
 * @param earlyCompletionBonus bonificación contractual por entrega anticipada
 * @param releasedCapacityValue margen de reasignar el equipo (valor teórico)
 * @param capacityReassignmentValidated si hay oportunidad concreta/aprobada
 * @param transitionCosts costos de cierre/transición
 */
export function earlyCompletionBenefit(args: {
  plannedRemainingCost?: number | null;
  forecastRemainingCost?: number | null;
  lostRevenue?: number | null;
  earlyCompletionBonus?: number | null;
  releasedCapacityValue?: number | null;
  capacityReassignmentValidated?: boolean;
  transitionCosts?: number | null;
  immaterialThreshold?: number; // |neto| por debajo => IMMATERIAL
}): EarlyCompletionResult {
  const {
    plannedRemainingCost,
    forecastRemainingCost,
    lostRevenue,
    earlyCompletionBonus,
    releasedCapacityValue,
    capacityReassignmentValidated = false,
    transitionCosts,
    immaterialThreshold = 0,
  } = args;

  const avoidedCost = sub(plannedRemainingCost, forecastRemainingCost);
  const bonus = isNum(earlyCompletionBonus) ? earlyCompletionBonus : 0;
  // Capacidad liberada: SOLO si está validada (regla §10 y caso 14/15).
  const validatedReleasedCapacityValue = capacityReassignmentValidated
    ? isNum(releasedCapacityValue)
      ? releasedCapacityValue
      : 0
    : 0;
  const lost = isNum(lostRevenue) ? lostRevenue : 0;
  const transition = isNum(transitionCosts) ? transitionCosts : 0;

  const assumptions: string[] = [];
  if (!capacityReassignmentValidated) {
    assumptions.push(
      "Capacidad liberada NO contabilizada: sin oportunidad concreta/regla aprobada (§10, caso 14).",
    );
  } else {
    assumptions.push(
      "Capacidad liberada incluida como costo de oportunidad recuperado y validado (caso 15).",
    );
  }
  if (!isNum(lostRevenue)) assumptions.push("lostRevenue asumido 0 (típico Fixed Price).");

  // Falta el insumo esencial: avoidedCost.
  if (!isNum(avoidedCost)) {
    return {
      netBenefit: null,
      verdict: "INSUFFICIENT_DATA",
      breakdown: {
        avoidedCost: null,
        lostRevenue: isNum(lostRevenue) ? lost : null,
        earlyCompletionBonus: bonus,
        validatedReleasedCapacityValue,
        transitionCosts: transition,
      },
      formula:
        "netBenefit = avoidedCost + bonus + validatedReleasedCapacity − lostRevenue − transitionCosts",
      explanation: "No existen datos suficientes para calcular el beneficio de finalizar antes.",
      assumptions,
    };
  }

  const netBenefit = round(
    (avoidedCost as number) + bonus + validatedReleasedCapacityValue - lost - transition,
  );

  let verdict: EarlyCompletionVerdict;
  let explanation: string;
  if (!isNum(netBenefit)) {
    verdict = "INSUFFICIENT_DATA";
    explanation = "No existen datos suficientes para calcular el beneficio de finalizar antes.";
  } else if (Math.abs(netBenefit) <= immaterialThreshold) {
    verdict = "IMMATERIAL";
    explanation = "Finalizar antes no cambia materialmente el resultado.";
  } else if (netBenefit > 0) {
    verdict = "INCREASES_PROFIT";
    explanation = "Finalizar antes aumenta la rentabilidad.";
  } else if (lost > 0) {
    verdict = "REDUCES_COST_AND_REVENUE";
    explanation =
      "Finalizar antes reduce costos, pero también reduce ingresos; el beneficio neto es negativo.";
  } else {
    verdict = "REDUCES_COST_AND_REVENUE";
    explanation = "Finalizar antes no conviene: los costos de transición superan al ahorro.";
  }

  return {
    netBenefit,
    verdict,
    breakdown: {
      avoidedCost: avoidedCost as number,
      lostRevenue: lost,
      earlyCompletionBonus: bonus,
      validatedReleasedCapacityValue,
      transitionCosts: transition,
    },
    formula:
      "netBenefit = avoidedCost + bonus + validatedReleasedCapacity − lostRevenue − transitionCosts",
    explanation,
    assumptions,
  };
}
