// Confidence Score (Etapa 1). 0..100 con banda y desglose auditable.
import type { ConfidenceBand } from "./types";

export interface ConfidenceInput {
  /** Cantidad de fuentes distintas que respaldan la conclusión. */
  sourceCount: number;
  /** ¿Al menos una es fuente PRINCIPAL para este dato? */
  hasPrimarySource: boolean;
  /** 0..1 — 1 = fuentes totalmente consistentes (sin contradicciones). */
  consistency: number;
  /** Días desde el dato más reciente. null = sin datos. */
  freshnessDays: number | null;
  /** ¿Hay histórico suficiente para tendencia? */
  hasHistory: boolean;
  /** ¿Evidencia directa (vs señal indirecta/inferida)? */
  directEvidence: boolean;
  /** 0..1 — fracción de campos/dimensiones requeridos que faltan. */
  missingRatio: number;
  /** ¿Los permisos/scopes son correctos? */
  permissionOk: boolean;
  /** Cantidad de errores de sincronización recientes. */
  syncErrors: number;
  /** 0..1 — cuánto depende la conclusión de inferencias. */
  inferenceDependency: number;
  /** 0..1 — cuánto depende de IA generativa. */
  aiDependency: number;
}

export interface ConfidenceResult {
  score: number; // 0..100
  band: ConfidenceBand;
  positives: string[];
  negatives: string[];
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score < 25) return "INSUFICIENTE";
  if (score < 50) return "BAJO";
  if (score < 70) return "MEDIO";
  if (score < 85) return "ALTO";
  return "MUY_ALTO";
}

/**
 * Fórmula ponderada, explicable. Ideal (todo a favor) ≈ 94 → "Muy alto".
 * Sin datos (0 fuentes) → 0 → "Insuficiente".
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const positives: string[] = [];
  const negatives: string[] = [];

  if (input.sourceCount <= 0 || input.freshnessDays === null) {
    return {
      score: 0,
      band: "INSUFICIENTE",
      positives,
      negatives: ["Sin fuentes de datos disponibles para esta conclusión."],
    };
  }

  let score = 6; // base

  // Autoridad
  if (input.hasPrimarySource) {
    score += 22;
    positives.push("Respaldado por una fuente principal.");
  } else {
    score += 8;
    negatives.push("Solo fuentes secundarias (sin fuente principal).");
  }

  // Cantidad de fuentes
  const qty = Math.min(input.sourceCount, 3) * 4;
  score += qty;
  if (input.sourceCount >= 2) positives.push(`${input.sourceCount} fuentes corroboran el dato.`);

  // Evidencia directa
  if (input.directEvidence) {
    score += 14;
    positives.push("Evidencia directa (no inferida).");
  } else {
    score += 4;
    negatives.push("Basado en señal indirecta.");
  }

  // Consistencia
  const cons = clamp(input.consistency, 0, 1) * 14;
  score += cons;
  if (input.consistency >= 0.9) positives.push("Fuentes consistentes entre sí.");
  else if (input.consistency < 0.6) negatives.push("Hay contradicciones entre fuentes.");

  // Histórico y permisos
  if (input.hasHistory) {
    score += 8;
    positives.push("Histórico suficiente para tendencia.");
  } else {
    negatives.push("Poco histórico para respaldar tendencia.");
  }
  if (input.permissionOk) score += 6;
  else negatives.push("Permisos/scopes insuficientes.");

  // Frescura
  const f = input.freshnessDays;
  if (f <= 2) {
    score += 12;
    positives.push("Datos frescos (≤ 2 días).");
  } else if (f <= 7) {
    score += 7;
  } else {
    score += 2;
    negatives.push(`Datos con ${Math.round(f)} días de antigüedad.`);
  }

  // Penalizaciones
  if (input.missingRatio > 0) {
    score -= clamp(input.missingRatio, 0, 1) * 12;
    if (input.missingRatio >= 0.3) negatives.push("Faltan datos requeridos.");
  }
  if (input.syncErrors > 0) {
    score -= Math.min(input.syncErrors, 3) * 4;
    negatives.push(`${input.syncErrors} error(es) de sincronización.`);
  }
  if (input.inferenceDependency > 0) {
    score -= clamp(input.inferenceDependency, 0, 1) * 8;
    if (input.inferenceDependency >= 0.5) negatives.push("Alta dependencia de inferencias.");
  }
  if (input.aiDependency > 0) {
    score -= clamp(input.aiDependency, 0, 1) * 6;
    if (input.aiDependency >= 0.5) negatives.push("Conclusión apoyada fuertemente en IA.");
  }

  const finalScore = Math.round(clamp(score));
  return { score: finalScore, band: confidenceBand(finalScore), positives, negatives };
}
