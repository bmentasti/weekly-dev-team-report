// Nivel de confianza de una EVALUACIÓN individual.
//
// Regla del spec: toda evaluación por persona debe exponer su nivel de confianza
// y, cuando la confianza es BAJA, NO mostrar un veredicto categórico sino primero
// qué datos hay que corregir/completar. Este módulo es PURO (sin Prisma) para
// poder testearlo aislado y reutilizarlo tanto en la generación como en la UI.
//
// La confianza combina: qué integraciones hay conectadas (cobertura de fuentes),
// cuán bien mapeados están los participantes, la completitud de los datos y la
// trazabilidad tarea→código→entrega. Nunca se apoya en una sola métrica.

import type { PersonInsight } from "./types";

export type ConfidenceLevel = "low" | "medium" | "high";

export interface EvaluationConfidence {
  /** Puntaje 0..100. */
  score: number;
  level: ConfidenceLevel;
  /** Categorías de integración conectadas (planning, code, ci, quality, …). */
  connectedIntegrations: string[];
  /** Categorías relevantes que faltan para una evaluación completa. */
  missingIntegrations: string[];
  /** Fracción de participantes resueltos a una identidad canónica (0..1). */
  participantMappingCoverage: number;
  /** Fracción de datos esperados que están presentes (0..1). */
  dataCompleteness: number;
  /** Fracción del trabajo "hecho" con evidencia de entrega trazable (0..1). */
  traceabilityCoverage: number;
  /** Advertencias legibles: qué corregir/completar primero. */
  warnings: string[];
}

/** Categorías de datos que aportan a una evaluación individual robusta. */
export const EVAL_CATEGORIES = ["planning", "code", "ci", "quality", "comms"] as const;
export type EvalCategory = (typeof EVAL_CATEGORIES)[number];

/** Mapea un slug de provider a su categoría de datos. */
const PROVIDER_CATEGORY: Record<string, EvalCategory> = {
  // Gestión ágil / planning
  jira: "planning",
  linear: "planning",
  trello: "planning",
  asana: "planning",
  clickup: "planning",
  monday: "planning",
  shortcut: "planning",
  notion: "planning",
  airtable: "planning",
  azureboards: "planning",
  azure_boards: "planning",
  ms_project: "planning",
  ms_planner: "planning",
  smartsheet: "planning",
  wrike: "planning",
  teamwork: "planning",
  basecamp: "planning",
  zoho_projects: "planning",
  primavera: "planning",
  jira_align: "planning",
  jira_roadmaps: "planning",
  // Código
  github: "code",
  gitlab: "code",
  bitbucket: "code",
  azuredevops: "code",
  azure_repos: "code",
  // CI/CD
  github_actions: "ci",
  gitlab_ci: "ci",
  jenkins: "ci",
  circleci: "ci",
  azure_pipelines: "ci",
  // Calidad / seguridad
  sonarqube: "quality",
  codecov: "quality",
  snyk: "quality",
  // Comunicación
  slack: "comms",
  teams: "comms",
  ms_teams: "comms",
  discord: "comms",
};

export function providerCategory(slug: string): EvalCategory | null {
  return PROVIDER_CATEGORY[slug.toLowerCase()] ?? null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export interface ConfidenceInputs {
  /** Slugs de integraciones conectadas del proyecto. */
  connectedProviders: string[];
  /** Categorías requeridas para la evaluación (default: planning + code). */
  requiredCategories?: EvalCategory[];
  participantMappingCoverage: number; // 0..1
  dataCompleteness: number; // 0..1
  traceabilityCoverage: number; // 0..1
  /** Advertencias externas (p. ej. sync con error, permisos faltantes). */
  extraWarnings?: string[];
}

/**
 * Calcula la confianza de una evaluación. Combina 4 señales (cobertura de
 * fuentes, mapeo de participantes, completitud, trazabilidad) con pesos; ninguna
 * por sí sola determina el resultado.
 */
export function computeEvaluationConfidence(input: ConfidenceInputs): EvaluationConfidence {
  const required = input.requiredCategories ?? ["planning", "code"];
  const connectedCats = new Set<string>();
  for (const p of input.connectedProviders) {
    const cat = providerCategory(p);
    if (cat) connectedCats.add(cat);
  }
  const connectedIntegrations = Array.from(connectedCats).sort();
  const missingIntegrations = EVAL_CATEGORIES.filter(
    (c) => required.includes(c) && !connectedCats.has(c),
  );

  const mapping = clamp01(input.participantMappingCoverage);
  const completeness = clamp01(input.dataCompleteness);
  const traceability = clamp01(input.traceabilityCoverage);

  // Cobertura de fuentes: fracción de categorías REQUERIDAS presentes.
  const sourceCoverage =
    required.length === 0
      ? 1
      : required.filter((c) => connectedCats.has(c)).length / required.length;

  // Pesos: fuentes 35, mapeo 25, completitud 20, trazabilidad 20.
  const score = Math.round(
    sourceCoverage * 35 + mapping * 25 + completeness * 20 + traceability * 20,
  );
  const level = levelFromScore(score);

  const warnings: string[] = [];
  for (const c of missingIntegrations) {
    warnings.push(`Falta una integración de ${c}: la evaluación no cubre esa dimensión.`);
  }
  if (mapping < 0.8)
    warnings.push(
      `Solo el ${Math.round(mapping * 100)}% de la actividad está vinculada a una persona; confirmá los mapeos pendientes.`,
    );
  if (traceability < 0.5)
    warnings.push(
      "Baja trazabilidad tarea→código→entrega: muchas conclusiones no son verificables end-to-end.",
    );
  if (completeness < 0.6)
    warnings.push("Datos parciales en el período: la evaluación puede no reflejar todo el trabajo.");
  for (const w of input.extraWarnings ?? []) warnings.push(w);

  return {
    score,
    level,
    connectedIntegrations,
    missingIntegrations,
    participantMappingCoverage: Number(mapping.toFixed(2)),
    dataCompleteness: Number(completeness.toFixed(2)),
    traceabilityCoverage: Number(traceability.toFixed(2)),
    warnings,
  };
}

/**
 * Cobertura de mapeo de participantes: fracción de personas resueltas a una
 * identidad canónica (`id` presente y distinto del nombre crudo).
 */
export function participantMappingCoverage(people: Pick<PersonInsight, "id" | "name">[]): number {
  if (people.length === 0) return 1;
  const mapped = people.filter((p) => p.id && p.id !== p.name).length;
  return mapped / people.length;
}

/**
 * Trazabilidad (proxy): fracción del trabajo "hecho" con evidencia de código
 * asociada (PRs mergeados). No es exacta —la correlación por ticket es la fuente
 * fina— pero da una señal honesta cuando no hay correlación disponible.
 */
export function traceabilityCoverage(
  people: Pick<PersonInsight, "tasksDone" | "prsMerged">[],
): number {
  const totalDone = people.reduce((s, p) => s + (p.tasksDone || 0), 0);
  if (totalDone === 0) return 1;
  const withCode = people.reduce((s, p) => s + Math.min(p.tasksDone || 0, p.prsMerged || 0), 0);
  return clamp01(withCode / totalDone);
}

export interface GatedVerdict<T> {
  /** true si la confianza alcanza para mostrar un veredicto categórico. */
  show: boolean;
  /** El veredicto original (solo si `show`). */
  verdict: T | null;
  confidence: EvaluationConfidence;
  /** Qué corregir/completar primero cuando `show` es false. */
  fixFirst: string[];
}

/**
 * Compuerta de veredicto: si la confianza es BAJA, NO se muestra un veredicto
 * categórico (p. ej. "Necesita apoyo"); en su lugar se devuelve qué datos
 * corregir primero. Con confianza media/alta, se muestra el veredicto.
 */
export function gateVerdict<T>(verdict: T, confidence: EvaluationConfidence): GatedVerdict<T> {
  if (confidence.level === "low") {
    return {
      show: false,
      verdict: null,
      confidence,
      fixFirst: confidence.warnings.length
        ? confidence.warnings
        : ["Conectá más fuentes y confirmá los mapeos de participantes antes de evaluar."],
    };
  }
  return { show: true, verdict, confidence, fixFirst: [] };
}
