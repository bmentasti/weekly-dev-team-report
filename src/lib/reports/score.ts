import type { HealthLevel, ReportMetrics } from "./types";

export type ScoreLevel =
  | "SALUDABLE"
  | "ESTABLE"
  | "OBSERVACION"
  | "RIESGO_MEDIO"
  | "ALTO_RIESGO"
  | "CRITICO";

export const LEVEL_LABEL: Record<ScoreLevel, string> = {
  SALUDABLE: "Saludable",
  ESTABLE: "Estable",
  OBSERVACION: "En observación",
  RIESGO_MEDIO: "Riesgo medio",
  ALTO_RIESGO: "Alto riesgo",
  CRITICO: "Crítico",
};

export function levelVariant(
  l: ScoreLevel,
): "success" | "secondary" | "warning" | "destructive" | "info" {
  if (l === "SALUDABLE" || l === "ESTABLE") return "success";
  if (l === "OBSERVACION") return "info";
  if (l === "RIESGO_MEDIO") return "warning";
  return "destructive";
}

export function levelOf(score: number): ScoreLevel {
  if (score >= 90) return "SALUDABLE";
  if (score >= 78) return "ESTABLE";
  if (score >= 64) return "OBSERVACION";
  if (score >= 50) return "RIESGO_MEDIO";
  if (score >= 35) return "ALTO_RIESGO";
  return "CRITICO";
}

/**
 * Score de salud 0-100 compuesto: parte del avance por SP y penaliza bloqueos,
 * bugs, PRs viejos/sin reviewer, CI y tareas sin movimiento.
 */
export function healthScore(
  m: ReportMetrics | null,
  health: HealthLevel | null,
): number {
  if (!m || !m.capacity) {
    if (health === "HEALTHY") return 88;
    if (health === "MEDIUM_RISK") return 65;
    if (health === "HIGH_RISK") return 45;
    return 60;
  }
  let s = m.projectProgress.completionByPoints;
  s -= m.workItems.blocked * 4;
  s -= m.workItems.stale * 2;
  s -= (m.quality?.bugsOpen ?? 0) * 3;
  s -= m.codeChanges.old * 2;
  s -= m.codeChanges.withoutReviewer * 2;
  s -= (m.ci?.failureRatePct ?? 0) * 0.3;
  return Math.max(0, Math.min(100, Math.round(s)));
}
