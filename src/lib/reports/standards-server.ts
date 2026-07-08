import "server-only";
import {
  mergeStandard,
  scoreWithStandard,
  DEFAULT_STANDARD,
  type HealthStandardConfig,
} from "./standards";
import { healthScore, levelOf, type ScoreLevel } from "./score";
import { healthStandardModel } from "./health-standard-model";
import type { HealthLevel, ReportMetrics } from "./types";

/**
 * Estándar efectivo con herencia: DEFAULT ← workspace ← proyecto.
 * Si se pasa projectId, el override del proyecto se aplica sobre el del
 * workspace, que a su vez se aplica sobre el base recomendado.
 */
export async function getEffectiveStandard(
  workspaceId: string,
  projectId?: string | null,
): Promise<HealthStandardConfig> {
  const hs = healthStandardModel();
  if (!hs) return DEFAULT_STANDARD;
  try {
    const wsRow = await hs.findFirst({
      where: { workspaceId, projectId: null },
    });
    let effective = mergeStandard(wsRow?.config ?? null);
    if (projectId) {
      const pRow = await hs.findFirst({ where: { workspaceId, projectId } });
      if (pRow?.config) {
        // el override de proyecto se aplica sobre el efectivo del workspace
        effective = mergeOnto(effective, pRow.config);
      }
    }
    return effective;
  } catch {
    // tabla inexistente (falta db:push) => defaults
  }
  return DEFAULT_STANDARD;
}

/** Aplica un override parcial sobre una base ya resuelta (no sobre DEFAULT). */
function mergeOnto(
  base: HealthStandardConfig,
  override: Partial<HealthStandardConfig>,
): HealthStandardConfig {
  return {
    thresholds: { ...base.thresholds, ...(override.thresholds ?? {}) },
    weights: { ...base.weights, ...(override.weights ?? {}) },
  };
}

/**
 * Fuente única de score+level para lectura (H11).
 * Prioriza el snapshot congelado del reporte (H3); si no existe (reportes
 * previos), lo calcula con el estándar vigente como mejor esfuerzo.
 */
export function resolveReportScore(
  snapshot: { score: number | null; scoreLevel: string | null },
  metrics: ReportMetrics | null,
  healthStatus: HealthLevel | null,
  standard: HealthStandardConfig,
): { score: number; level: ScoreLevel } {
  if (snapshot.score != null && snapshot.scoreLevel) {
    return { score: snapshot.score, level: snapshot.scoreLevel as ScoreLevel };
  }
  const sc = scoreWithStandard(metrics, standard);
  const score = sc.score ?? healthScore(metrics, healthStatus);
  const level = sc.level === "SIN_DATOS" ? levelOf(score) : sc.level;
  return { score, level };
}
