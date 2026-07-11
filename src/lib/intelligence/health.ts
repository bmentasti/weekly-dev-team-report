// Health Score multidimensional (Etapa 3).
// No es un promedio simple: cada dimensión tiene peso configurable por perfil
// (tipo de proyecto / fase). v1: la "salud" se deriva de la cobertura de datos
// (readiness) — cuando se ingesten métricas vivas, se enchufan como `signals`.
import type { CoverageReport, ConfidenceBand, CoverageLevel } from "./types";

export type HealthProfile = "default" | "startup" | "bank";

interface HealthDimDef {
  key: string;
  label: string;
  /** Claves de dimensiones de cobertura que la alimentan. */
  coverageKeys: string[];
}

export const HEALTH_DIMENSIONS: HealthDimDef[] = [
  { key: "planning", label: "Planning", coverageKeys: ["planning", "roadmap"] },
  { key: "delivery", label: "Delivery", coverageKeys: ["progress", "deployments"] },
  { key: "code", label: "Code", coverageKeys: ["code", "pull_requests"] },
  { key: "quality", label: "Quality", coverageKeys: ["quality"] },
  { key: "testing", label: "Testing", coverageKeys: ["testing", "coverage"] },
  { key: "security", label: "Security", coverageKeys: ["security"] },
  { key: "production", label: "Production", coverageKeys: ["production", "observability"] },
  { key: "incidents", label: "Incidents", coverageKeys: ["incidents"] },
  { key: "capacity", label: "Capacity", coverageKeys: ["capacity", "workload"] },
  { key: "cost", label: "Cost", coverageKeys: ["costs"] },
  { key: "risk", label: "Risk", coverageKeys: ["risks"] },
  { key: "documentation", label: "Documentation", coverageKeys: ["documentation"] },
];

/** Pesos por perfil (se normalizan en el cálculo). */
export const WEIGHT_PROFILES: Record<HealthProfile, Record<string, number>> = {
  default: {
    planning: 1, delivery: 1.2, code: 1, quality: 1, testing: 1, security: 1,
    production: 1, incidents: 1, capacity: 1, cost: 0.8, risk: 1, documentation: 0.6,
  },
  startup: {
    planning: 0.8, delivery: 1.6, code: 1.2, quality: 0.8, testing: 0.7, security: 0.6,
    production: 0.8, incidents: 0.8, capacity: 1, cost: 1.2, risk: 0.8, documentation: 0.4,
  },
  bank: {
    planning: 1, delivery: 0.8, code: 1, quality: 1.5, testing: 1.3, security: 1.8,
    production: 1.5, incidents: 1.5, capacity: 0.9, cost: 0.9, risk: 1.4, documentation: 1,
  },
};

export interface HealthDimension {
  key: string;
  label: string;
  score: number | null; // null = datos insuficientes
  weight: number;
  confidence: ConfidenceBand;
  coverageLevel: CoverageLevel;
  status: "ok" | "warn" | "risk" | "insufficient";
  recommended: string[];
}

export interface HealthReport {
  overall: number | null;
  profile: HealthProfile;
  dimensions: HealthDimension[];
}

function statusFor(score: number): "ok" | "warn" | "risk" {
  if (score >= 70) return "ok";
  if (score >= 45) return "warn";
  return "risk";
}

/**
 * Deriva la salud (readiness) de cada dimensión a partir de la cobertura y
 * la agrega ponderada por perfil. Las dimensiones sin datos quedan como
 * "insufficient" y NO contaminan el promedio.
 */
export function computeHealth(
  coverage: CoverageReport,
  profile: HealthProfile = "default",
): HealthReport {
  const covByKey = new Map(coverage.dimensions.map((d) => [d.key, d]));
  const weights = WEIGHT_PROFILES[profile];

  const dimensions: HealthDimension[] = HEALTH_DIMENSIONS.map((def) => {
    const covs = def.coverageKeys
      .map((k) => covByKey.get(k))
      .filter((d): d is NonNullable<typeof d> => d !== undefined);
    const known = covs.filter((d) => d.coverage > 0);
    const weight = weights[def.key] ?? 1;

    if (known.length === 0) {
      const recommended = Array.from(new Set(covs.flatMap((d) => d.recommended)));
      return {
        key: def.key,
        label: def.label,
        score: null,
        weight,
        confidence: "INSUFICIENTE",
        coverageLevel: "INSUFICIENTE",
        status: "insufficient",
        recommended,
      };
    }

    const score = Math.round(known.reduce((s, d) => s + d.coverage, 0) / known.length);
    // Peor confianza/nivel entre las cubiertas (conservador).
    const worst = known.reduce((a, b) => (b.coverage < a.coverage ? b : a));
    return {
      key: def.key,
      label: def.label,
      score,
      weight,
      confidence: worst.confidence,
      coverageLevel: worst.level,
      status: statusFor(score),
      recommended: [],
    };
  });

  const scored = dimensions.filter((d) => d.score !== null);
  const totalWeight = scored.reduce((s, d) => s + d.weight, 0);
  const overall =
    scored.length === 0 || totalWeight === 0
      ? null
      : Math.round(scored.reduce((s, d) => s + (d.score as number) * d.weight, 0) / totalWeight);

  return { overall, profile, dimensions };
}
