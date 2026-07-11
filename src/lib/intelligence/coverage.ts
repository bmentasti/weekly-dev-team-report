// Data Coverage Model (Etapa 1).
// Calcula cuánto sabe DevMetrics de cada dimensión, a partir de las
// integraciones conectadas. NO depende solo de la cantidad de apps: pondera
// autoridad de la fuente, redundancia, frescura y estado de sync.
import type { Capability } from "./capabilities";
import { PROVIDER_CAPABILITIES } from "./capabilities";
import type {
  ConnectedSource,
  CoverageLevel,
  CoverageReport,
  DimensionCoverage,
  ConfidenceBand,
} from "./types";

interface DimensionDef {
  key: string;
  label: string;
  primary: Capability[];
  secondary: Capability[];
  recommended: string[];
  impact: string;
}

/** 24 dimensiones del proyecto y qué capabilities las alimentan. */
export const DIMENSIONS: DimensionDef[] = [
  { key: "planning", label: "Planificación", primary: ["project_management", "portfolio_management"], secondary: [], recommended: ["Jira", "MS Project"], impact: "No se puede evaluar el plan ni sus desvíos." },
  { key: "roadmap", label: "Roadmap", primary: ["portfolio_management"], secondary: ["project_management"], recommended: ["Jira Advanced Roadmaps", "MS Project"], impact: "No hay visión de fechas comprometidas ni dependencias." },
  { key: "tasks", label: "Tareas", primary: ["project_management"], secondary: [], recommended: ["Jira", "Linear"], impact: "No se puede analizar backlog ni estados." },
  { key: "progress", label: "Avance", primary: ["project_management"], secondary: ["source_control"], recommended: ["Jira", "GitHub"], impact: "No se puede contrastar avance planificado vs real." },
  { key: "code", label: "Código", primary: ["source_control"], secondary: [], recommended: ["GitHub", "GitLab"], impact: "No hay evidencia de actividad real de repositorio." },
  { key: "pull_requests", label: "Pull requests", primary: ["pull_requests"], secondary: [], recommended: ["GitHub", "GitLab"], impact: "No se puede medir review time ni time-to-merge." },
  { key: "quality", label: "Calidad", primary: ["code_quality"], secondary: ["source_control"], recommended: ["SonarQube", "Code Climate"], impact: "No se puede afirmar deuda técnica ni mantenibilidad." },
  { key: "testing", label: "Testing", primary: ["testing"], secondary: [], recommended: ["Cypress", "Playwright"], impact: "No hay visibilidad de estado de tests." },
  { key: "coverage", label: "Cobertura", primary: ["coverage"], secondary: [], recommended: ["Codecov", "Coveralls"], impact: "No se conoce la cobertura de tests." },
  { key: "security", label: "Seguridad", primary: ["security"], secondary: [], recommended: ["Snyk", "Dependabot"], impact: "No se puede evaluar exposición a vulnerabilidades." },
  { key: "cicd", label: "CI/CD", primary: ["ci_cd"], secondary: [], recommended: ["Jenkins", "CircleCI"], impact: "No hay métricas de build ni pipeline." },
  { key: "deployments", label: "Deployments", primary: ["deployments"], secondary: ["ci_cd"], recommended: ["Vercel", "Argo CD"], impact: "No se puede medir frecuencia de deploy ni change failure rate." },
  { key: "production", label: "Producción", primary: ["observability"], secondary: [], recommended: ["Sentry", "Datadog"], impact: "No hay visibilidad del estado real en producción." },
  { key: "observability", label: "Observabilidad", primary: ["observability"], secondary: [], recommended: ["Datadog", "Grafana"], impact: "No se conocen latencia, SLO ni servicios degradados." },
  { key: "incidents", label: "Incidentes", primary: ["incidents"], secondary: ["observability"], recommended: ["PagerDuty", "Opsgenie", "Sentry"], impact: "No se puede medir MTTR ni reincidencia." },
  { key: "communication", label: "Comunicación", primary: ["communication"], secondary: [], recommended: ["Slack", "Teams"], impact: "No se detectan bloqueos ni decisiones no documentadas." },
  { key: "documentation", label: "Documentación", primary: ["documentation"], secondary: [], recommended: ["Confluence", "Notion"], impact: "No se conoce la cobertura documental." },
  { key: "design", label: "Diseño", primary: ["design"], secondary: [], recommended: ["Figma", "Miro"], impact: "No se puede cruzar diseño con implementación." },
  { key: "capacity", label: "Capacidad", primary: ["capacity"], secondary: ["time_tracking", "project_management"], recommended: ["Google Calendar", "HR"], impact: "No se conoce disponibilidad real ni sobrecarga." },
  { key: "workload", label: "Carga de trabajo", primary: ["project_management"], secondary: ["time_tracking"], recommended: ["Jira", "Time tracking"], impact: "No se puede evaluar distribución de trabajo." },
  { key: "time_tracking", label: "Time tracking", primary: ["time_tracking"], secondary: [], recommended: ["Harvest", "Toggl"], impact: "No hay horas reales vs estimadas." },
  { key: "costs", label: "Costos", primary: ["costs"], secondary: [], recommended: ["AWS Cost Explorer", "Azure Cost"], impact: "No se puede evaluar presupuesto ni burn rate." },
  { key: "risks", label: "Riesgos", primary: ["project_management"], secondary: ["incidents", "source_control"], recommended: ["Jira", "Sentry"], impact: "El análisis de riesgo será parcial." },
  { key: "predictability", label: "Predictibilidad", primary: ["project_management"], secondary: ["source_control"], recommended: ["Jira", "GitHub"], impact: "El forecast tendrá baja confianza sin histórico." },
];

function levelFor(coverage: number): CoverageLevel {
  if (coverage < 25) return "INSUFICIENTE";
  if (coverage < 50) return "INICIAL";
  if (coverage < 70) return "BASICO";
  if (coverage < 85) return "AVANZADO";
  return "INTEGRAL";
}

function confidenceFor(coverage: number, hasPrimary: boolean): ConfidenceBand {
  if (coverage <= 0) return "INSUFICIENTE";
  if (coverage < 40) return "BAJO";
  if (coverage < 65) return "MEDIO";
  if (coverage < 85) return hasPrimary ? "ALTO" : "MEDIO";
  return "MUY_ALTO";
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Cobertura de una dimensión dado el set de fuentes CONECTADAS. */
export function coverageForDimension(
  def: DimensionDef,
  connected: ConnectedSource[],
  now: Date = new Date(),
): DimensionCoverage {
  const feeders = connected.filter((s) => {
    if (s.status !== "CONNECTED") return false;
    const caps = PROVIDER_CAPABILITIES[s.slug] ?? [];
    return def.primary.some((c) => caps.includes(c)) || def.secondary.some((c) => caps.includes(c));
  });

  if (feeders.length === 0) {
    return {
      key: def.key,
      label: def.label,
      coverage: 0,
      level: "INSUFICIENTE",
      confidence: "INSUFICIENTE",
      sources: [],
      sourceCount: 0,
      freshnessDays: null,
      missing: [`Sin fuente para ${def.label.toLowerCase()}`],
      recommended: def.recommended,
      impact: def.impact,
    };
  }

  const hasPrimary = feeders.some((s) => {
    const caps = PROVIDER_CAPABILITIES[s.slug] ?? [];
    return def.primary.some((c) => caps.includes(c));
  });

  let base = hasPrimary ? 70 : 45;
  base += Math.min(feeders.length - 1, 2) * 7; // redundancia (máx +14)

  // Frescura: el sync más reciente entre las fuentes.
  const syncDays = feeders
    .map((s) => (s.lastSyncAt ? daysBetween(now, s.lastSyncAt) : null))
    .filter((d): d is number => d !== null);
  const freshnessDays = syncDays.length ? Math.min(...syncDays) : null;
  if (freshnessDays !== null) {
    if (freshnessDays > 7) base -= 20;
    else if (freshnessDays > 2) base -= 8;
  }

  const coverage = Math.round(clamp(base));
  const missing = def.primary.length && !hasPrimary ? ["Falta una fuente principal"] : [];

  return {
    key: def.key,
    label: def.label,
    coverage,
    level: levelFor(coverage),
    confidence: confidenceFor(coverage, hasPrimary),
    sources: feeders.map((s) => s.label),
    sourceCount: feeders.length,
    freshnessDays: freshnessDays === null ? null : Math.round(freshnessDays),
    missing,
    recommended: hasPrimary ? [] : def.recommended,
    impact: def.impact,
  };
}

/** Informe de cobertura completo por proyecto/equipo/organización. */
export function computeCoverage(
  connected: ConnectedSource[],
  now: Date = new Date(),
): CoverageReport {
  const dimensions = DIMENSIONS.map((d) => coverageForDimension(d, connected, now));
  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + d.coverage, 0) / dimensions.length,
  );
  return {
    overall,
    level: levelFor(overall),
    connectedCount: connected.filter((s) => s.status === "CONNECTED").length,
    categoriesCovered: dimensions.filter((d) => d.coverage > 0).length,
    totalDimensions: dimensions.length,
    dimensions,
  };
}
