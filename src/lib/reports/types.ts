import type { ProviderSlug } from "@/lib/integrations/catalog";

export type HealthLevel = "HEALTHY" | "MEDIUM_RISK" | "HIGH_RISK";
export type RiskLevel = "high" | "medium" | "low";

export interface WorkItemMetrics {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  todo: number;
  stale: number;
  critical: number;
}

export interface CodeChangeMetrics {
  total: number;
  open: number;
  merged: number;
  closedNoMerge: number;
  withoutReviewer: number;
  checksFailing: number;
  old: number;
  avgOpenAgeHours: number;
}

export interface ActivityMetrics {
  messages: number;
  blockers: number;
  activePeople: number;
}

export interface PersonRollup {
  name: string;
  tasksDone: number;
  tasksInProgress: number;
  tasksBlocked: number;
  tasksStale: number;
  prsOpen: number;
  prsMerged: number;
}

export type PersonCategory =
  | "RECOGNIZE"
  | "SUPPORT"
  | "OVERLOADED"
  | "FREE_CAPACITY"
  | "ON_TRACK";

export interface PersonInsight extends PersonRollup {
  committedPoints: number;
  completedPoints: number;
  wip: number;
  throughput: number;
  cycleTimeAvgDays: number | null;
  category: PersonCategory;
  score: number;
  rank: number;
  nextStep: string;
}

export interface CapacityMetrics {
  committedPoints: number;
  completedPoints: number;
  velocityPoints: number;
  remainingPoints: number;
  cycleTimeAvgDays: number | null;
}

export interface ProjectProgress {
  totalItems: number;
  doneItems: number;
  remainingItems: number;
  completionByCount: number; // 0-100
  completionByPoints: number; // 0-100
}

export interface StatusDistribution {
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
}

export interface PlanningInputs {
  carryOverItems: number;
  carryOverPoints: number;
  forecastPoints: number;
  focus: { externalId: string; title: string; url: string; reason: string }[];
}

export interface TrendPoint {
  label: string;
  done: number;
  merged: number;
  blocked: number;
  velocityPoints: number;
  health: HealthLevel | null;
}

export interface QualityMetrics {
  bugs: number;
  bugsDone: number;
  bugsOpen: number;
  defectRatePct: number; // bugs / total work items
  scopeCreepItems: number; // agregadas después del inicio del período
  scopeCreepPct: number;
  readyForQa: number; // en review/QA/demo, sin cerrar
}

export interface CiMetrics {
  total: number;
  success: number;
  failed: number;
  running: number;
  failureRatePct: number; // sobre corridas completadas
  deployFailed: number;
}

export interface ReportMetrics {
  workItems: WorkItemMetrics;
  codeChanges: CodeChangeMetrics;
  activity: ActivityMetrics;
  quality: QualityMetrics;
  ci: CiMetrics;
  capacity: CapacityMetrics;
  projectProgress: ProjectProgress;
  statusDistribution: StatusDistribution;
  planning: PlanningInputs;
  trend: TrendPoint[];
  /**
   * Evolución DENTRO del período del reporte, en cortes de ~15 días. Es lo que
   * grafica la card "Tendencia" del detalle (fechas siempre distintas);
   * `trend` (histórico entre reportes) queda para previsibilidad/planning y
   * como fallback en reportes viejos que no tienen timeline.
   */
  timeline?: TrendPoint[];
  people: PersonInsight[];
  sources: ProviderSlug[];
}

export interface Risk {
  level: RiskLevel;
  title: string;
  detail: string;
}

export interface HighlightItem {
  externalId: string;
  title: string;
  url: string;
  meta?: string;
}

export interface ReportHighlights {
  tasksDone: HighlightItem[];
  tasksAtRisk: HighlightItem[];
  prsMerged: HighlightItem[];
  prsAtRisk: HighlightItem[];
}

export interface ReportComputation {
  healthStatus: HealthLevel;
  summary: string;
  metrics: ReportMetrics;
  risks: Risk[];
  recommendations: string[];
  highlights: ReportHighlights;
  markdown: string;
  sourcesWithError: ProviderSlug[];
}
