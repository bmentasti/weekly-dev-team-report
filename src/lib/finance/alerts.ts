// Alertas accionables (§20). Genera alertas a partir del snapshot financiero.
// Cada alerta trae severidad, explicación, fórmula, evidencia, fuente,
// confianza y acción sugerida. Puro (opera sobre el snapshot ya calculado).

import { isNum } from "./money";
import type { FinancialSnapshot } from "./engine";
import type { Confidence } from "./types";

export type AlertSeverity = "high" | "medium" | "low";

export interface FinanceAlert {
  id: string;
  severity: AlertSeverity;
  explanation: string;
  formula: string;
  evidence: string;
  source: string;
  confidence: Confidence;
  suggestedAction: string;
}

const SEV_ORDER: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };

function money(v: number | null, currency: string): string {
  if (!isNum(v)) return "s/d";
  return `${currency} ${Math.round(v).toLocaleString("en-US")}`;
}

/**
 * Deriva las alertas del snapshot. `hasMargins` controla si se emiten alertas
 * que exponen margen/ganancia (respeta el enmascarado por permisos).
 */
export function generateAlerts(
  s: FinancialSnapshot,
  opts: { hasMargins?: boolean } = {},
): FinanceAlert[] {
  const out: FinanceAlert[] = [];
  const c = s.currency;
  const hasMargins = opts.hasMargins ?? true;

  const completion = s.progressVsSpend.completionPct;
  const consumed = s.progressVsSpend.consumedPct;
  const eac = s.evm.eac.value;
  const currentBudget = s.budget.currentBudget.value;
  const projMargin = s.profitability.projectedMarginPct.value;
  const targetMargin = s.profitability.marginVariance.provenance.inputs.targetMarginPct as number | null;
  const projProfit = s.profitability.projectedProfit.value;
  const runway = s.budget.runwayDays.value;

  // Consumo desalineado con el avance.
  if (isNum(consumed) && isNum(completion) && consumed > completion + 5) {
    out.push({
      id: "spend-ahead-of-progress",
      severity: "high",
      explanation: `El proyecto consumió el ${consumed}% del presupuesto y generó el ${completion}% del valor planificado.`,
      formula: "consumido% vs avance real%",
      evidence: `consumido=${consumed}% · avance=${completion}%`,
      source: "Presupuesto y Earned Value",
      confidence: "MEDIUM",
      suggestedAction: "Revisar productividad, alcance y estimación restante (ETC).",
    });
  }

  // EAC supera el presupuesto vigente.
  if (isNum(eac) && isNum(currentBudget) && eac > currentBudget) {
    out.push({
      id: "eac-over-budget",
      severity: "high",
      explanation: `El EAC supera el presupuesto vigente en ${money(eac - currentBudget, c)}.`,
      formula: "VAC = BAC − EAC (negativo)",
      evidence: `EAC=${money(eac, c)} · presupuesto=${money(currentBudget, c)}`,
      source: "EVM",
      confidence: "MEDIUM",
      suggestedAction: "Evaluar ampliación presupuestaria o reducción de alcance/costo.",
    });
  }

  // Margen proyectado por debajo del objetivo.
  if (hasMargins && isNum(projMargin) && isNum(targetMargin) && projMargin < targetMargin) {
    out.push({
      id: "margin-below-target",
      severity: projMargin < 0 ? "high" : "medium",
      explanation: `El margen proyectado (${projMargin}%) está por debajo del objetivo (${targetMargin}%).`,
      formula: "marginVariance = margen proyectado − objetivo",
      evidence: `proyectado=${projMargin}% · objetivo=${targetMargin}%`,
      source: "Rentabilidad proyectada",
      confidence: "MEDIUM",
      suggestedAction: "Renegociar precio/alcance o reducir costo restante.",
    });
  }

  // Presupuesto se agota antes del cierre forecast.
  const t = s.temporal;
  if (isNum(runway) && s.budget.exhaustionDate.date) {
    out.push({
      id: "budget-exhaustion",
      severity: "medium",
      explanation: `Manteniendo el burn rate actual, el presupuesto alcanza para ~${Math.round(runway)} días.`,
      formula: "runway = presupuesto disponible / burn rate",
      evidence: `agotamiento estimado=${new Date(s.budget.exhaustionDate.date).toLocaleDateString("es")}`,
      source: "Burn rate reciente",
      confidence: "MEDIUM",
      suggestedAction: "Planificar financiamiento o ajustar ritmo de gasto.",
    });
  }

  // Días de atraso absorbibles.
  if (hasMargins && isNum(t.breakEvenDelayDays.value)) {
    out.push({
      id: "delay-absorb",
      severity: t.breakEvenDelayDays.value < 10 ? "high" : "low",
      explanation: `El proyecto puede absorber ~${Math.round(t.breakEvenDelayDays.value)} días de atraso antes de entrar en pérdida.`,
      formula: "breakEvenDelayDays = ganancia proyectada / costo diario de atraso",
      evidence: `costo semanal de atraso=${money(t.incrementalWeeklyDelayCost.value, c)}`,
      source: "Rentabilidad temporal",
      confidence: "MEDIUM",
      suggestedAction: "Proteger el camino crítico y anticipar riesgos de cronograma.",
    });
  }

  // Scope creep no aprobado.
  const sc = s.risks.scopeCreep;
  if (!sc.insufficientData && sc.hasUnapprovedCreep) {
    out.push({
      id: "scope-creep-unapproved",
      severity: "medium",
      explanation: `El alcance creció ${sc.growthPct}% y sólo ${sc.approvedGrowthPct}% fue aprobado como presupuesto adicional.`,
      formula: "scopeGrowth% aprobado vs no aprobado",
      evidence: `no aprobado=${sc.unapprovedGrowthPct}%`,
      source: "Cambios de alcance",
      confidence: "MEDIUM",
      suggestedAction: "Formalizar un change request o frenar el alcance no aprobado.",
    });
  }

  // Retrabajo significativo.
  const rw = s.risks.rework;
  if (!rw.insufficientData && rw.significant) {
    out.push({
      id: "rework-significant",
      severity: "medium",
      explanation: `El retrabajo representa el ${rw.reworkPct}% del costo laboral acumulado.`,
      formula: "rework% = costo retrabajo / costo laboral",
      evidence: `costo retrabajo=${money(rw.cost, c)}`,
      source: "Calidad / retrabajo",
      confidence: "MEDIUM",
      suggestedAction: "Atacar causas raíz (requisitos ambiguos, QA temprano, revisiones).",
    });
  }

  // TCPI poco realista.
  const tcpi = s.evm.tcpiBac.value;
  if (isNum(tcpi) && tcpi > 1.1) {
    out.push({
      id: "tcpi-unrealistic",
      severity: "medium",
      explanation: `El TCPI requerido para cumplir el presupuesto es ${tcpi} (poco realista).`,
      formula: "TCPI = (BAC − EV) / (BAC − AC)",
      evidence: `TCPI=${tcpi}`,
      source: "EVM",
      confidence: "MEDIUM",
      suggestedAction: "Ajustar presupuesto o alcance: la eficiencia exigida no es alcanzable.",
    });
  }

  // Ganancia proyectada negativa.
  if (hasMargins && isNum(projProfit) && projProfit < 0) {
    out.push({
      id: "projected-loss",
      severity: "high",
      explanation: `La ganancia proyectada es negativa (${money(projProfit, c)}).`,
      formula: "projectedProfit = ingreso proyectado − EAC",
      evidence: `pérdida proyectada=${money(Math.abs(projProfit), c)}`,
      source: "Rentabilidad proyectada",
      confidence: "MEDIUM",
      suggestedAction: "Escalar: renegociar, recortar costo o revisar viabilidad.",
    });
  }

  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

/** Alerta principal (mayor severidad) para vistas resumidas (portafolio). */
export function topAlert(alerts: FinanceAlert[]): FinanceAlert | null {
  return alerts[0] ?? null;
}
