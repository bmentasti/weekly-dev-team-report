// Escenarios y simulaciones (§13). Puro y testeable. NO modifica datos reales:
// deriva resultados a partir de una base numérica + ajustes. No inventa
// probabilidades: usa confianza cualitativa (HIGH/MEDIUM/LOW) con motivo.

import { isNum, round, sub, pct } from "./money";
import type { Confidence } from "./types";

/** Base numérica del proyecto (extraída del snapshot) para simular. */
export interface ScenarioBase {
  ac: number | null; // costo real a hoy
  etc: number | null; // costo restante estimado (plan)
  bac: number | null;
  cpi: number | null;
  spi: number | null;
  projectedRevenue: number | null;
  targetMarginPct?: number | null;
  forecastEndDate?: string | null; // ISO
  baselineProfit?: number | null;
}

export interface ScenarioAdjustments {
  /** Multiplica el costo restante (ETC). 0.9 = 10% menos. */
  etcMultiplier?: number;
  /** Multiplica el ingreso proyectado. */
  revenueMultiplier?: number;
  extraCost?: number;
  extraRevenue?: number;
  penalties?: number;
  bonuses?: number;
  /** Días respecto de la fecha forecast (+atraso / -adelanto). */
  daysDelta?: number;
}

export interface ScenarioResult {
  key: string;
  label: string;
  confidence: Confidence;
  confidenceReason: string;
  finalCost: number | null; // EAC del escenario
  finalRevenue: number | null;
  profit: number | null;
  marginPct: number | null;
  eac: number | null;
  etc: number | null;
  vac: number | null;
  cpi: number | null;
  spi: number | null;
  endDate: string | null;
  diffVsBaselineProfit: number | null;
}

function addDaysISO(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Calcula un escenario a partir de la base y los ajustes. */
export function computeScenario(
  base: ScenarioBase,
  adj: ScenarioAdjustments,
  meta: { key: string; label: string; confidence: Confidence; confidenceReason: string },
): ScenarioResult {
  const etcMult = isNum(adj.etcMultiplier) ? adj.etcMultiplier : 1;
  const revMult = isNum(adj.revenueMultiplier) ? adj.revenueMultiplier : 1;
  const extraCost = isNum(adj.extraCost) ? adj.extraCost : 0;
  const extraRevenue = isNum(adj.extraRevenue) ? adj.extraRevenue : 0;
  const penalties = isNum(adj.penalties) ? adj.penalties : 0;
  const bonuses = isNum(adj.bonuses) ? adj.bonuses : 0;

  const etcAdj = isNum(base.etc) ? round(base.etc * etcMult + extraCost) : extraCost || null;
  const eac = isNum(base.ac) && isNum(etcAdj) ? round(base.ac + etcAdj) : null;
  const revenue = isNum(base.projectedRevenue)
    ? round(base.projectedRevenue * revMult + extraRevenue + bonuses - penalties)
    : null;
  const profit = sub(revenue, eac);
  const marginPct = pct(profit, revenue);
  const vac = sub(base.bac, eac);
  const diff = isNum(profit) && isNum(base.baselineProfit) ? round(profit - base.baselineProfit) : null;

  return {
    key: meta.key,
    label: meta.label,
    confidence: meta.confidence,
    confidenceReason: meta.confidenceReason,
    finalCost: eac,
    finalRevenue: revenue,
    profit,
    marginPct,
    eac,
    etc: etcAdj,
    vac,
    cpi: base.cpi,
    spi: base.spi,
    endDate: addDaysISO(base.forecastEndDate, isNum(adj.daysDelta) ? adj.daysDelta : 0),
    diffVsBaselineProfit: diff,
  };
}

/**
 * Presets base/optimista/probable/pesimista. La confianza es cualitativa y se
 * explica; no se presentan probabilidades numéricas inventadas (§13).
 */
export function buildPresetScenarios(base: ScenarioBase): ScenarioResult[] {
  // "Probable": si la eficiencia de costo (CPI) es < 1, se asume que la
  // ineficiencia continúa (ETC / CPI). Si no hay CPI, igual que el plan.
  const probableMult = isNum(base.cpi) && base.cpi > 0 && base.cpi < 1 ? 1 / base.cpi : 1;
  return [
    computeScenario(base, {}, {
      key: "base",
      label: "Base (forecast actual)",
      confidence: "MEDIUM",
      confidenceReason: "Continuidad del forecast vigente.",
    }),
    computeScenario(base, { etcMultiplier: 0.9, daysDelta: -10 }, {
      key: "optimistic",
      label: "Optimista",
      confidence: "LOW",
      confidenceReason: "Supone menor costo restante y adelanto; sin evidencia aún.",
    }),
    computeScenario(base, { etcMultiplier: probableMult }, {
      key: "likely",
      label: "Probable (ritmo reciente)",
      confidence: "MEDIUM",
      confidenceReason:
        probableMult > 1
          ? "Proyecta que la ineficiencia de costo actual (CPI<1) continúa."
          : "Ritmo de costo reciente en línea con el plan.",
    }),
    computeScenario(base, { etcMultiplier: 1.2, daysDelta: 15 }, {
      key: "pessimistic",
      label: "Pesimista",
      confidence: "LOW",
      confidenceReason: "Supone sobrecosto y atraso por bloqueos/rework.",
    }),
  ];
}
