// Evaluación MULTIDIMENSIONAL de una persona (auditoría §8).
//
// La evaluación NO depende de una sola métrica. Se computan dimensiones, cada
// una con: métricas que la alimentan, fórmula, umbrales, evidencias y si hay
// datos suficientes. Cuando faltan datos, la dimensión queda `available:false`
// (no se inventa un número). Módulo PURO y testeable.

import type { PersonInsight } from "./types";

export type DimensionKey =
  | "impact"
  | "collaboration"
  | "quality"
  | "autonomy"
  | "growth"
  | "predictability";

export interface DimensionResult {
  key: DimensionKey;
  available: boolean;
  score: number | null; // 0..100 cuando available
  weight: number;
  inputs: string[]; // métricas que la alimentan
  formula: string; // descripción legible
  evidence: string[]; // evidencias concretas o motivo de falta de datos
}

export interface EvaluationBreakdown {
  dimensions: DimensionResult[];
  /** Promedio ponderado de las dimensiones disponibles (null si ninguna). */
  overall: number | null;
  availableCount: number;
  /** ¿Hay suficientes dimensiones para una evaluación confiable? */
  sufficient: boolean;
}

export interface DimensionContext {
  /** Serie de throughput por período, del más viejo al más nuevo. */
  throughputSeries: number[];
  /** ¿Hay datos de código (GitHub conectado y persona vinculada)? */
  hasCode: boolean;
  /** ¿Hay datos de planificación (tareas)? */
  hasPlanning: boolean;
}

const WEIGHTS: Record<DimensionKey, number> = {
  impact: 0.25,
  collaboration: 0.15,
  quality: 0.2,
  autonomy: 0.15,
  growth: 0.1,
  predictability: 0.15,
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const varc = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(varc);
}

/**
 * Computa las 6 dimensiones a partir del último período de la persona + su
 * historial + qué datos hay disponibles.
 */
export function computeDimensions(
  latest: PersonInsight | null,
  ctx: DimensionContext,
): EvaluationBreakdown {
  const p = latest;
  const dims: DimensionResult[] = [];

  // --- Impacto: entregas del período ---
  dims.push(
    p && ctx.hasPlanning
      ? {
          key: "impact",
          available: true,
          score: clamp(p.throughput * 12 + p.completedPoints * 3),
          weight: WEIGHTS.impact,
          inputs: ["throughput", "completedPoints", "prsMerged"],
          formula: "min(100, throughput·12 + completedPoints·3)",
          evidence: [
            `${p.tasksDone} tareas finalizadas`,
            `${p.completedPoints} story points`,
            `${p.prsMerged} PRs mergeados`,
          ],
        }
      : unavailable("impact", ["throughput", "completedPoints"], "Sin datos de planificación."),
  );

  // --- Colaboración: participación en código (proxy honesto) ---
  dims.push(
    p && ctx.hasCode
      ? {
          key: "collaboration",
          available: true,
          score: clamp(p.prsMerged * 15 + p.prsOpen * 5),
          weight: WEIGHTS.collaboration,
          inputs: ["prsMerged", "prsOpen"],
          formula: "min(100, prsMerged·15 + prsOpen·5) — proxy (faltan reviews por persona)",
          evidence: [`${p.prsMerged} PRs mergeados`, `${p.prsOpen} PRs abiertos`],
        }
      : unavailable(
          "collaboration",
          ["reviews", "prsMerged"],
          "Sin datos de código/reviews por persona.",
        ),
  );

  // --- Calidad: penaliza trabas y estancamiento (proxy; sin bugs por persona) ---
  dims.push(
    p && ctx.hasPlanning
      ? {
          key: "quality",
          available: true,
          score: clamp(100 - p.tasksStale * 15 - p.tasksBlocked * 10),
          weight: WEIGHTS.quality,
          inputs: ["tasksStale", "tasksBlocked"],
          formula: "100 − tasksStale·15 − tasksBlocked·10 (proxy; sin bugs/regresiones por persona)",
          evidence: [
            `${p.tasksStale} tareas sin movimiento`,
            `${p.tasksBlocked} bloqueadas`,
          ],
        }
      : unavailable("quality", ["bugs", "regresiones"], "Sin datos de calidad por persona."),
  );

  // --- Autonomía: avanza con pocos bloqueos ---
  dims.push(
    p && ctx.hasPlanning
      ? {
          key: "autonomy",
          available: true,
          score: clamp(p.throughput * 12 - p.tasksBlocked * 8),
          weight: WEIGHTS.autonomy,
          inputs: ["throughput", "tasksBlocked"],
          formula: "min(100, throughput·12 − tasksBlocked·8)",
          evidence: [`${p.throughput} throughput`, `${p.tasksBlocked} bloqueadas`],
        }
      : unavailable("autonomy", ["throughput", "tasksBlocked"], "Sin datos de planificación."),
  );

  // --- Crecimiento: vs su propio período anterior (necesita ≥2 períodos) ---
  const s = ctx.throughputSeries;
  dims.push(
    s.length >= 2
      ? {
          key: "growth",
          available: true,
          score: clamp(50 + (s[s.length - 1] - s[s.length - 2]) * 10),
          weight: WEIGHTS.growth,
          inputs: ["throughput (histórico propio)"],
          formula: "50 + (throughput_actual − throughput_previo)·10",
          evidence: [
            `throughput ${s[s.length - 2]} → ${s[s.length - 1]} vs período anterior`,
          ],
        }
      : unavailable("growth", ["throughput histórico"], "Falta historial (≥2 períodos)."),
  );

  // --- Predictibilidad: consistencia del throughput (necesita ≥3 períodos) ---
  dims.push(
    s.length >= 3
      ? {
          key: "predictability",
          available: true,
          score: clamp(100 - stddev(s) * 12),
          weight: WEIGHTS.predictability,
          inputs: ["throughput (varianza histórica)"],
          formula: "100 − desvío_estándar(throughput)·12",
          evidence: [`desvío ${stddev(s).toFixed(1)} sobre ${s.length} períodos`],
        }
      : unavailable(
          "predictability",
          ["throughput histórico"],
          "Falta historial (≥3 períodos).",
        ),
  );

  const avail = dims.filter((d) => d.available);
  const totalW = avail.reduce((a, d) => a + d.weight, 0);
  const overall =
    totalW > 0
      ? Math.round(avail.reduce((a, d) => a + (d.score ?? 0) * d.weight, 0) / totalW)
      : null;

  return {
    dimensions: dims,
    overall,
    availableCount: avail.length,
    // Suficiente si hay al menos 3 dimensiones con datos (evita veredictos
    // sostenidos por una sola señal).
    sufficient: avail.length >= 3,
  };
}

function unavailable(
  key: DimensionKey,
  inputs: string[],
  reason: string,
): DimensionResult {
  return {
    key,
    available: false,
    score: null,
    weight: WEIGHTS[key],
    inputs,
    formula: "—",
    evidence: [reason],
  };
}
