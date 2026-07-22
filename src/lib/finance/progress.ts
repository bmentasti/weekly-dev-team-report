// Avance económico (Earned Value físico), combinación ponderada.
//
// Regla del §9: el Earned Value NO se calcula contando tareas. Se configura por
// story points, horas, peso por entregable, milestones, % contractual o pesos
// manuales — o una COMBINACIÓN ponderada de estos. Este módulo produce el % de
// avance real (0..100) que luego alimenta EV = BAC × (%/100).

import { isNum, round, pct } from "./money";
import type { ProgressResult, Provenance, Confidence } from "./types";

export interface StoryPointsProgress {
  completedPoints: number | null;
  totalPoints: number | null;
}

export interface MilestoneProgress {
  key: string;
  weight: number; // peso relativo
  percentComplete: number; // 0..100
}

export interface ManualProgress {
  /** % de avance declarado manualmente por el PM (0..100). */
  percentComplete: number | null;
}

export interface WeightedProgressConfig {
  /** Peso de la fuente story points en la combinación (0..1). */
  storyPointsWeight?: number;
  /** Peso de la fuente milestones (0..1). */
  milestoneWeight?: number;
  /** Peso de la fuente manual (0..1). */
  manualWeight?: number;
}

function confidenceFor(sources: number): Confidence {
  if (sources >= 2) return "HIGH";
  if (sources === 1) return "MEDIUM";
  return "NONE";
}

/** Avance por story points: completados / totales × 100. */
export function storyPointsPct(sp: StoryPointsProgress): number | null {
  return pct(sp.completedPoints, sp.totalPoints);
}

/** Avance por milestones ponderados: Σ(peso×%)/Σpeso. */
export function milestonePct(milestones: MilestoneProgress[]): number | null {
  if (!milestones.length) return null;
  let num = 0;
  let den = 0;
  for (const m of milestones) {
    if (!isNum(m.weight) || !isNum(m.percentComplete)) continue;
    num += m.weight * m.percentComplete;
    den += m.weight;
  }
  if (den === 0) return null;
  return round(num / den, 2);
}

/**
 * Combinación ponderada de fuentes de avance. Sólo pondera las fuentes que
 * tienen dato; renormaliza los pesos sobre las presentes. Devuelve
 * insuficiencia (completionPct=null) si ninguna fuente aporta dato.
 */
export function weightedProgress(args: {
  storyPoints?: StoryPointsProgress;
  milestones?: MilestoneProgress[];
  manual?: ManualProgress;
  config?: WeightedProgressConfig;
}): ProgressResult {
  const cfg = args.config ?? {};
  const parts: { label: string; pct: number; weight: number }[] = [];

  const spPct = args.storyPoints ? storyPointsPct(args.storyPoints) : null;
  if (isNum(spPct)) {
    parts.push({ label: "storyPoints", pct: spPct, weight: cfg.storyPointsWeight ?? 0.5 });
  }
  const msPct = args.milestones ? milestonePct(args.milestones) : null;
  if (isNum(msPct)) {
    parts.push({ label: "milestones", pct: msPct, weight: cfg.milestoneWeight ?? 0.3 });
  }
  const mnPct = args.manual?.percentComplete;
  if (isNum(mnPct)) {
    parts.push({ label: "manual", pct: mnPct, weight: cfg.manualWeight ?? 0.2 });
  }

  const usedSources = parts.map((p) => p.label);
  const provenanceBase: Omit<Provenance, "confidence"> = {
    formula: "Σ(pesoᵢ × %avanceᵢ) / Σpesoᵢ (pesos renormalizados sobre fuentes presentes)",
    inputs: {
      storyPointsPct: spPct,
      milestonePct: msPct,
      manualPct: isNum(mnPct) ? mnPct : null,
      sources: usedSources.join(",") || "ninguna",
    },
    source: usedSources.length ? `Avance combinado (${usedSources.join(" + ")})` : "Sin fuente de avance",
    assumptions:
      usedSources.length < 2
        ? ["Una sola fuente de avance: confianza limitada."]
        : undefined,
  };

  if (!parts.length) {
    return {
      completionPct: null,
      method: "WEIGHTED_COMBINATION",
      provenance: { ...provenanceBase, confidence: "NONE" },
    };
  }

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) {
    return {
      completionPct: null,
      method: "WEIGHTED_COMBINATION",
      provenance: { ...provenanceBase, confidence: "NONE" },
    };
  }
  const weighted = parts.reduce((s, p) => s + p.pct * p.weight, 0) / totalWeight;

  return {
    completionPct: round(weighted, 2),
    method: "WEIGHTED_COMBINATION",
    provenance: { ...provenanceBase, confidence: confidenceFor(parts.length) },
  };
}
