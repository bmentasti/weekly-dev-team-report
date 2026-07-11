// Recomendaciones inteligentes (Etapa 3).
// v1: basadas en reglas sobre la cobertura de datos. Cada recomendación es
// accionable y trae evidencia, impacto, prioridad, esfuerzo y confianza.
import type { CoverageReport } from "./types";

export type RecoPriority = "low" | "medium" | "high";
export type RecoEffort = "low" | "medium" | "high";
export type RecoStatus =
  | "NEW"
  | "REVIEWED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "DONE"
  | "DISMISSED";

export interface Recommendation {
  id: string;
  title: string;
  problem: string;
  evidence: string[];
  impact: string;
  action: string;
  priority: RecoPriority;
  effort: RecoEffort;
  benefit: string;
  confidence: number; // 0..100
  sources: string[];
  missing: string[];
  status: RecoStatus;
  kind: "integration" | "process";
}

/** Dimensiones cuya ausencia es más crítica (para priorizar recomendaciones). */
const HIGH_VALUE = new Set(["quality", "security", "production", "incidents", "coverage"]);

/**
 * Genera recomendaciones a partir del informe de cobertura:
 *  - integraciones faltantes para dimensiones sin datos;
 *  - refuerzo de fuentes para dimensiones con solo fuente secundaria.
 */
export function generateRecommendations(coverage: CoverageReport): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const dim of coverage.dimensions) {
    if (dim.coverage === 0 && dim.recommended.length > 0) {
      const high = HIGH_VALUE.has(dim.key);
      recs.push({
        id: `connect-${dim.key}`,
        kind: "integration",
        title: `Conectá ${dim.recommended[0]} para cubrir ${dim.label}`,
        problem: `No hay datos de ${dim.label.toLowerCase()}: ${dim.impact}`,
        evidence: [`Cobertura de ${dim.label}: 0%`],
        impact: dim.impact,
        action: `Conectar ${dim.recommended.slice(0, 2).join(" o ")} desde Integraciones.`,
        priority: high ? "high" : "medium",
        effort: "low",
        benefit: `Habilita la dimensión ${dim.label} y sube la confianza de análisis.`,
        confidence: 90,
        sources: [],
        missing: [dim.label],
        status: "NEW",
      });
    } else if (dim.coverage > 0 && dim.missing.some((m) => /principal/i.test(m))) {
      recs.push({
        id: `reinforce-${dim.key}`,
        kind: "integration",
        title: `Reforzá ${dim.label} con una fuente principal`,
        problem: `${dim.label} se apoya solo en fuentes secundarias.`,
        evidence: [`Fuentes actuales: ${dim.sources.join(", ") || "—"}`],
        impact: "La confianza de esta dimensión es menor de la que podría ser.",
        action: `Conectar una fuente principal (${dim.recommended.slice(0, 2).join(" o ")}).`,
        priority: "medium",
        effort: "low",
        benefit: `Sube la confianza de ${dim.label} a Alta.`,
        confidence: 80,
        sources: dim.sources,
        missing: ["fuente principal"],
        status: "NEW",
      });
    }
  }

  // Orden: prioridad alta primero, luego por dimensión de alto valor.
  const order: Record<RecoPriority, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}
