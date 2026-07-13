// Reglas de alerta personalizadas (Pro): el usuario define condiciones sobre
// métricas ("bugs > 8", "completion rate < 70") y DevMetrics las evalúa contra
// cada reporte. Solo lógica pura (sin Prisma) para poder usarse client-side.

import { METRIC_DEFS, metricValue } from "./standards";
import type { ReportMetrics } from "./types";

export type RuleOperator = "gt" | "lt" | "gte" | "lte";
export type RuleSeverity = "high" | "medium" | "low";

export const OPERATOR_LABEL: Record<RuleOperator, string> = {
  gt: "mayor que",
  lt: "menor que",
  gte: "mayor o igual que",
  lte: "menor o igual que",
};

export const SEVERITY_LABEL: Record<RuleSeverity, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export interface AlertRuleInput {
  metricKey: string;
  operator: RuleOperator;
  threshold: number;
  severity: RuleSeverity;
}

export interface AlertRule extends AlertRuleInput {
  id: string;
  enabled: boolean;
}

export interface EvaluatedRule {
  rule: AlertRule;
  metricLabel: string;
  unit: string;
  value: number | null; // null = sin datos
  triggered: boolean;
}

export function matches(op: RuleOperator, value: number, threshold: number): boolean {
  switch (op) {
    case "gt":
      return value > threshold;
    case "lt":
      return value < threshold;
    case "gte":
      return value >= threshold;
    case "lte":
      return value <= threshold;
  }
}

/** Evalúa las reglas habilitadas contra las métricas de un reporte. */
export function evaluateAlertRules(
  rules: AlertRule[],
  m: ReportMetrics | null,
): EvaluatedRule[] {
  return rules
    .filter((r) => r.enabled)
    .map((rule) => {
      const def = METRIC_DEFS.find((d) => d.key === rule.metricKey);
      const value = m ? metricValue(rule.metricKey, m) : null;
      return {
        rule,
        metricLabel: def?.label ?? rule.metricKey,
        unit: def?.unit ?? "",
        value,
        triggered: value !== null && matches(rule.operator, value, rule.threshold),
      };
    });
}

/**
 * Texto legible de una regla, ej: "Bugs abiertos máx. mayor que 8".
 * `t` es opcional: si se pasa, el operador sale traducido; si no, cae a español.
 */
export function ruleText(
  rule: AlertRuleInput,
  t?: (key: string) => string,
): string {
  const def = METRIC_DEFS.find((d) => d.key === rule.metricKey);
  const label = def?.label ?? rule.metricKey;
  const unit = def?.unit ? ` ${def.unit}` : "";
  const operator = t ? t(`lib.operator.${rule.operator}`) : OPERATOR_LABEL[rule.operator];
  return `${label} ${operator} ${rule.threshold}${unit}`;
}
