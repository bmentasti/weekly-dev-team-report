// Motor de informe adaptativo (Etapa 3).
// Deriva el ESTADO de cada sección del informe según la cobertura disponible.
// Las secciones sin datos NO se muestran como error, sino con su estado real.
import type { CoverageReport, ConfidenceBand } from "./types";

export type SectionState =
  | "AVAILABLE"
  | "PARTIAL"
  | "LIMITED"
  | "NO_DATA"
  | "STALE";

export interface ReportSection {
  key: string;
  label: string;
  state: SectionState;
  coverage: number; // 0..100 (promedio de sus dimensiones)
  confidence: ConfidenceBand;
  /** Dimensiones de cobertura que la componen. */
  coverageKeys: string[];
  note: string;
}

interface SectionDef {
  key: string;
  label: string;
  coverageKeys: string[];
}

/** Secciones del informe, alineadas a los tabs de la UI. */
export const REPORT_SECTIONS: SectionDef[] = [
  { key: "planning", label: "Planning", coverageKeys: ["planning", "roadmap", "tasks"] },
  { key: "delivery", label: "Delivery", coverageKeys: ["progress", "deployments"] },
  { key: "code", label: "Code", coverageKeys: ["code", "pull_requests"] },
  { key: "quality", label: "Quality", coverageKeys: ["quality"] },
  { key: "testing", label: "Testing", coverageKeys: ["testing", "coverage"] },
  { key: "security", label: "Security", coverageKeys: ["security"] },
  { key: "cicd", label: "CI/CD", coverageKeys: ["cicd"] },
  { key: "production", label: "Production", coverageKeys: ["production", "observability"] },
  { key: "incidents", label: "Incidents", coverageKeys: ["incidents"] },
  { key: "team", label: "Team", coverageKeys: ["capacity", "workload", "communication"] },
  { key: "costs", label: "Costs", coverageKeys: ["costs"] },
  { key: "risks", label: "Risks", coverageKeys: ["risks", "predictability"] },
];

function stateFor(coverage: number, stale: boolean): SectionState {
  if (coverage === 0) return "NO_DATA";
  if (stale) return "STALE";
  if (coverage >= 70) return "AVAILABLE";
  if (coverage >= 50) return "PARTIAL";
  return "LIMITED";
}

const STATE_NOTE: Record<SectionState, string> = {
  AVAILABLE: "Datos suficientes para análisis.",
  PARTIAL: "Análisis parcial; conviene reforzar fuentes.",
  LIMITED: "Datos limitados; conclusiones acotadas.",
  NO_DATA: "Sin fuente conectada para esta sección.",
  STALE: "Datos desactualizados; confianza reducida.",
};

export function buildAdaptiveReport(coverage: CoverageReport): {
  sections: ReportSection[];
} {
  const byKey = new Map(coverage.dimensions.map((d) => [d.key, d]));

  const sections = REPORT_SECTIONS.map((def) => {
    const dims = def.coverageKeys
      .map((k) => byKey.get(k))
      .filter((d): d is NonNullable<typeof d> => d !== undefined);
    const cov = dims.length
      ? Math.round(dims.reduce((s, d) => s + d.coverage, 0) / dims.length)
      : 0;
    const stale = dims.some((d) => d.freshnessDays !== null && d.freshnessDays > 7);
    // Confianza = mejor entre las dimensiones cubiertas.
    const covered = dims.filter((d) => d.coverage > 0);
    const confidence: ConfidenceBand = covered.length
      ? covered.reduce<ConfidenceBand>(
          (best, d) => (rank(d.confidence) > rank(best) ? d.confidence : best),
          "INSUFICIENTE",
        )
      : "INSUFICIENTE";
    const state = stateFor(cov, stale && cov > 0);
    return {
      key: def.key,
      label: def.label,
      state,
      coverage: cov,
      confidence,
      coverageKeys: def.coverageKeys,
      note: STATE_NOTE[state],
    };
  });

  return { sections };
}

function rank(b: ConfidenceBand): number {
  return ["INSUFICIENTE", "BAJO", "MEDIO", "ALTO", "MUY_ALTO"].indexOf(b);
}
