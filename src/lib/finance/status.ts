// Estado financiero del proyecto (§19). Reglas explicables: cada estado informa
// qué regla se activó y con qué datos. Nunca concluye si faltan insumos clave.

import { isNum } from "./money";
import type { FinancialStatus } from "./types";

export interface StatusRule {
  triggered: boolean;
  code: string;
  message: string;
}

export interface StatusResult {
  status: FinancialStatus;
  reasons: StatusRule[];
  explanation: string;
}

export interface StatusInputs {
  projectedProfit?: number | null;
  projectedMarginPct?: number | null;
  targetMarginPct?: number | null;
  eac?: number | null;
  currentBudget?: number | null;
  cpi?: number | null;
  spi?: number | null;
  budgetRunwayDays?: number | null;
  daysToForecastEnd?: number | null;
  forecastEndsAfterContractual?: boolean;
  unapprovedScopeCreep?: boolean;
  significantRework?: boolean;
  hasRecoverableScenario?: boolean;
}

/**
 * Clasifica el estado combinando reglas. Se toma el estado MÁS severo cuya regla
 * se dispare. Requiere, como mínimo, poder evaluar ganancia o margen proyectado;
 * si no, devuelve INSUFFICIENT_DATA (no inventa un estado).
 */
export function financialStatus(i: StatusInputs): StatusResult {
  const reasons: StatusRule[] = [];
  const canEvaluate = isNum(i.projectedProfit) || isNum(i.projectedMarginPct) || isNum(i.eac);
  if (!canEvaluate) {
    return {
      status: "INSUFFICIENT_DATA",
      reasons: [
        {
          triggered: true,
          code: "NO_CORE_METRICS",
          message: "Sin ganancia/margen/EAC proyectados: no se concluye el estado.",
        },
      ],
      explanation: "Información insuficiente para determinar el estado financiero.",
    };
  }

  // ---- CRÍTICO ----
  const critical: StatusRule[] = [];
  if (isNum(i.projectedProfit) && i.projectedProfit < 0)
    critical.push({ triggered: true, code: "NEGATIVE_PROFIT", message: "Ganancia proyectada negativa." });
  if (isNum(i.projectedMarginPct) && i.projectedMarginPct < 0)
    critical.push({ triggered: true, code: "NEGATIVE_MARGIN", message: "Margen proyectado negativo." });
  if (isNum(i.budgetRunwayDays) && isNum(i.daysToForecastEnd) && i.budgetRunwayDays < i.daysToForecastEnd && i.budgetRunwayDays <= 0)
    critical.push({ triggered: true, code: "BUDGET_EXHAUSTED", message: "Presupuesto agotado." });
  if (i.hasRecoverableScenario === false && critical.length)
    critical.push({ triggered: true, code: "NO_RECOVERY", message: "Sin escenario razonable de recuperación." });

  // ---- EN RIESGO ----
  const atRisk: StatusRule[] = [];
  if (isNum(i.eac) && isNum(i.currentBudget) && i.eac > i.currentBudget)
    atRisk.push({ triggered: true, code: "EAC_OVER_BUDGET", message: "EAC supera el presupuesto vigente." });
  if (isNum(i.projectedMarginPct) && i.projectedMarginPct >= 0 && i.projectedMarginPct < 3)
    atRisk.push({ triggered: true, code: "MARGIN_NEAR_ZERO", message: "Margen proyectado cercano a cero." });
  if (i.forecastEndsAfterContractual)
    atRisk.push({ triggered: true, code: "LATE_FORECAST", message: "Fecha forecast posterior a la contractual." });
  if (i.unapprovedScopeCreep)
    atRisk.push({ triggered: true, code: "SCOPE_CREEP", message: "Scope creep sin aprobación." });
  if (i.significantRework)
    atRisk.push({ triggered: true, code: "REWORK", message: "Retrabajo significativo." });
  if (isNum(i.budgetRunwayDays) && isNum(i.daysToForecastEnd) && i.budgetRunwayDays < i.daysToForecastEnd)
    atRisk.push({ triggered: true, code: "RUNWAY_SHORT", message: "El presupuesto se agota antes del cierre forecast." });

  // ---- ATENCIÓN ----
  const attention: StatusRule[] = [];
  if (isNum(i.projectedMarginPct) && isNum(i.targetMarginPct) && i.projectedMarginPct < i.targetMarginPct && i.projectedMarginPct >= 3)
    attention.push({ triggered: true, code: "BELOW_TARGET_MARGIN", message: "Margen por debajo del objetivo." });
  if (isNum(i.cpi) && i.cpi < 0.95)
    attention.push({ triggered: true, code: "CPI_LOW", message: "CPI con desviación (gasta más valor del que genera)." });
  if (isNum(i.spi) && i.spi < 0.9)
    attention.push({ triggered: true, code: "SPI_LOW", message: "SPI con desviación (atraso)." });

  if (critical.length) {
    reasons.push(...critical);
    return { status: "CRITICAL", reasons, explanation: critical[0].message };
  }
  if (atRisk.length) {
    reasons.push(...atRisk);
    return { status: "AT_RISK", reasons, explanation: atRisk[0].message };
  }
  if (attention.length) {
    reasons.push(...attention);
    return { status: "ATTENTION", reasons, explanation: attention[0].message };
  }

  return {
    status: "HEALTHY",
    reasons: [
      {
        triggered: true,
        code: "ON_TRACK",
        message: "Margen proyectado ≥ objetivo, EAC dentro del presupuesto y sin riesgos críticos.",
      },
    ],
    explanation: "Proyecto saludable: dentro de presupuesto y margen objetivo.",
  };
}
