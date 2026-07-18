// Comparación de una persona contra su PROPIO historial.
//
// El spec pide priorizar la evolución de cada persona respecto de sus períodos
// anteriores antes que rankings entre compañeros. Este módulo es PURO: recibe la
// serie de puntos de la persona (un punto por reporte, del más viejo al más
// nuevo) y devuelve deltas por métrica y una tendencia propia, sin comparar con
// terceros.

import type { PerfTier } from "./people-profile";

export interface PersonHistoryPoint {
  label: string;
  tasksDone: number;
  throughput: number;
  completedPoints: number;
  blocked: number;
  stale: number;
  tier: PerfTier;
}

export type MetricDirection = "up" | "down" | "flat";

export interface MetricDelta {
  metric: string;
  current: number;
  previous: number;
  deltaAbs: number;
  deltaPct: number | null; // null si el período previo era 0
  /** Interpretación: ¿el cambio es bueno, malo o neutro para la persona? */
  sentiment: "good" | "bad" | "neutral";
  direction: MetricDirection;
}

export interface PersonSelfComparison {
  /** Cantidad de períodos disponibles. */
  sampleSize: number;
  /** true si hay al menos 2 períodos para comparar. */
  comparable: boolean;
  deltas: MetricDelta[];
  /** Tendencia propia global (mejora / empeora / estable). */
  trend: MetricDirection;
  summary: string;
}

// Para cada métrica: ¿subir es bueno (+1) o malo (-1)?
const GOOD_WHEN_UP: Record<string, 1 | -1> = {
  tasksDone: 1,
  throughput: 1,
  completedPoints: 1,
  blocked: -1,
  stale: -1,
};

function delta(metric: string, current: number, previous: number): MetricDelta {
  const deltaAbs = current - previous;
  const deltaPct = previous === 0 ? null : (deltaAbs / Math.abs(previous)) * 100;
  const dir: MetricDirection = deltaAbs > 0 ? "up" : deltaAbs < 0 ? "down" : "flat";
  const polarity = GOOD_WHEN_UP[metric] ?? 1;
  const sentiment: MetricDelta["sentiment"] =
    deltaAbs === 0 ? "neutral" : deltaAbs * polarity > 0 ? "good" : "bad";
  return { metric, current, previous, deltaAbs, deltaPct, sentiment, direction: dir };
}

/**
 * Compara el último período de la persona contra el inmediatamente anterior
 * (su propio historial). Devuelve deltas por métrica y una tendencia global.
 *
 * @param pointsOldestFirst serie ordenada del más viejo al más nuevo.
 */
export function comparePersonToSelf(pointsOldestFirst: PersonHistoryPoint[]): PersonSelfComparison {
  const n = pointsOldestFirst.length;
  if (n < 2) {
    return {
      sampleSize: n,
      comparable: false,
      deltas: [],
      trend: "flat",
      summary:
        n === 0
          ? "Sin historial de la persona en el proyecto."
          : "Primer período de la persona: aún no hay base propia para comparar.",
    };
  }
  const cur = pointsOldestFirst[n - 1];
  const prev = pointsOldestFirst[n - 2];
  const deltas = [
    delta("tasksDone", cur.tasksDone, prev.tasksDone),
    delta("throughput", cur.throughput, prev.throughput),
    delta("completedPoints", cur.completedPoints, prev.completedPoints),
    delta("blocked", cur.blocked, prev.blocked),
    delta("stale", cur.stale, prev.stale),
  ];
  const good = deltas.filter((d) => d.sentiment === "good").length;
  const bad = deltas.filter((d) => d.sentiment === "bad").length;
  const trend: MetricDirection = good > bad ? "up" : bad > good ? "down" : "flat";
  const summary =
    trend === "up"
      ? `Mejora respecto de su período anterior (${good} señales positivas vs ${bad}).`
      : trend === "down"
        ? `Retrocede respecto de su período anterior (${bad} señales negativas vs ${good}).`
        : "Estable respecto de su período anterior.";
  return { sampleSize: n, comparable: true, deltas, trend, summary };
}
