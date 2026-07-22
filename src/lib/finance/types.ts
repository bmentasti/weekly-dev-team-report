// Tipos de dominio del motor financiero. Son PLANOS (números y strings), sin
// dependencia de Prisma ni de la base de datos, para que todo el servicio de
// cálculo sea unit-testeable en memoria (§8: servicio centralizado y testeable).
// Un mapper aparte convertirá Prisma Decimal -> number antes de invocar esto.

export type ContractModality =
  | "FIXED_PRICE"
  | "TIME_AND_MATERIALS"
  | "MANAGED_CAPACITY"
  | "MILESTONE_BASED"
  | "RETAINER"
  | "HYBRID";

export type CostNature = "ACTUAL" | "COMMITTED" | "FORECAST" | "POTENTIAL";

export type FinancialStatus =
  | "HEALTHY"
  | "ATTENTION"
  | "AT_RISK"
  | "CRITICAL"
  | "INSUFFICIENT_DATA";

/** Nivel de confianza cualitativo cuando no hay modelo estadístico validado. */
export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type EacMethod = "cost" | "cost_schedule" | "bottom_up" | "simple";

/**
 * Trazabilidad de cada resultado (§21). Toda métrica debe poder explicar cómo
 * se obtuvo: fórmula, insumos, fuente, confianza y supuestos.
 */
export interface Provenance {
  formula: string;
  inputs: Record<string, number | string | null | undefined>;
  source: string; // p.ej. "Jira", "Config manual", "CSV facturación"
  confidence: Confidence;
  assumptions?: string[];
}

/** Resultado de una métrica: valor + explicación, o insuficiencia de datos. */
export interface MetricResult {
  value: number | null;
  /** true cuando faltan insumos y NO se debe concluir nada. */
  insufficientData: boolean;
  provenance: Provenance;
  note?: string;
}

/** Helper para construir un MetricResult marcando insuficiencia si value es null. */
export function metric(
  value: number | null,
  provenance: Provenance,
  note?: string,
): MetricResult {
  return {
    value,
    insufficientData: value === null,
    provenance,
    note,
  };
}

/** Insumos económicos del proyecto (config + baseline + agregados de costo/ingreso). */
export interface FinanceInputs {
  modality: ContractModality;
  currency: string;
  asOf: Date; // fecha de corte del cálculo
  // ---- Fechas ----
  startDate?: Date | null;
  plannedEndDate?: Date | null;
  contractualEndDate?: Date | null;
  forecastEndDate?: Date | null;
  workingDaysPerWeek?: number; // default 5
  // ---- Ingresos ----
  contractedRevenue?: number | null;
  maxAuthorizedRevenue?: number | null; // tope/cap
  recognizedRevenue?: number | null;
  invoicedRevenue?: number | null;
  projectedTotalRevenue?: number | null; // si null, se estima
  changeRequestRevenue?: number | null;
  bonuses?: number | null;
  penalties?: number | null; // monto positivo; se descuenta según config
  // ---- Presupuesto de costos ----
  originalBudget?: number | null;
  approvedBudgetIncreases?: number | null;
  approvedBudgetReductions?: number | null;
  contingency?: number | null;
  // ---- Costos ----
  actualCost?: number | null; // AC (nature=ACTUAL)
  committedCosts?: number | null; // nature=COMMITTED
  // ---- Objetivo ----
  targetMarginPct?: number | null; // 0..100
  // ---- Avance ----
  progress?: ProgressResult | null;
  // ---- Baseline ----
  baselineEstimatedCost?: number | null;
  // ---- EVM manual overrides ----
  bacOverride?: number | null; // Budget At Completion explícito
  plannedValueOverride?: number | null;
  earnedValueOverride?: number | null;
}

/** Resultado del cálculo de avance económico (Earned Value físico). */
export interface ProgressResult {
  /** % de trabajo realmente completado (0..100). */
  completionPct: number | null;
  method: string;
  provenance: Provenance;
}
