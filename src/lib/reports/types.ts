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

/**
 * Alcance del sprint: conteos sobre tareas ÚNICAS del período + trazabilidad de
 * lo descartado (fuera de período, sin fechas, duplicados). Permite reconciliar
 * el total con Airtable y explicar por qué el total ya no incluye backlog.
 */
export interface SprintScopeMetrics {
  uniqueTasks: number;
  committed: number; // existían al inicio del sprint
  addedDuringSprint: number; // incorporadas durante el sprint (no penalizan el compromiso)
  completed: number;
  inProgress: number;
  blocked: number;
  pending: number;
  carriedOver: number; // no completadas al cierre (se trasladan)
  committedCompleted: number;
  commitmentCompletionPct: number; // committedCompleted / committed
  excludedOutOfPeriod: number; // backlog / otros sprints / futuras
  insufficientData: number; // sin fechas utilizables
  duplicatesCollapsed: number; // filas colapsadas por deduplicación
  lastSyncedAt: string; // ISO — última sincronización con la fuente
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
  /**
   * ID canónico y único de la persona dentro del proyecto (identity layer).
   * Estable entre reportes y unificado cross-app. Opcional por retro-
   * compatibilidad con reportes viejos; el keying downstream usa `id ?? name`.
   */
  id?: string;
  name: string;
  tasksDone: number;
  tasksInProgress: number;
  tasksBlocked: number;
  tasksStale: number;
  /** Tareas asignadas en estado TODO (pendientes, sin empezar). */
  tasksTodo?: number;
  /** Tareas comprometidas (existían al inicio del sprint) asignadas a la persona. */
  committedTasks?: number;
  /** Tareas incorporadas durante el sprint asignadas a la persona. */
  addedTasks?: number;
  prsOpen: number;
  prsMerged: number;
}

export type PersonCategory =
  | "RECOGNIZE"
  | "SUPPORT"
  | "OVERLOADED"
  | "FREE_CAPACITY"
  | "ON_TRACK"
  | "INSUFFICIENT_DATA";

/**
 * Punto de la evolución DENTRO del período del reporte, por persona. Permite que
 * el gráfico del perfil muestre el avance a lo largo de los días del sprint (no
 * un único punto por reporte). Opcional: reportes viejos no lo tienen.
 */
export interface PersonTimelinePoint {
  label: string;
  done: number;
  merged: number;
  blocked: number;
  velocityPoints: number;
}

export interface PersonInsight extends PersonRollup {
  committedPoints: number;
  completedPoints: number;
  wip: number;
  throughput: number;
  cycleTimeAvgDays: number | null;
  category: PersonCategory;
  /**
   * Explicación específica y verificable de por qué la persona quedó en esa
   * categoría (evidencia con números). Nunca un mensaje genérico. Opcional por
   * retro-compatibilidad con reportes previos.
   */
  categoryReason?: string;
  score: number;
  rank: number;
  nextStep: string;
  /**
   * Evolución por cortes dentro del período (finalizadas, PRs mergeados,
   * bloqueadas, velocity). Se computa en la generación y se suma al unificar
   * identidades. Opcional por retro-compatibilidad con reportes previos.
   */
  timeline?: PersonTimelinePoint[];
  /**
   * Última actividad conocida de la persona en CUALQUIER integración (ISO),
   * medida sobre datos sin recortar al período. Se usa para excluir a quienes
   * llevan más de `REPORT_INACTIVE_DAYS` sin actividad (gente que salió del
   * proyecto). Opcional: reportes viejos previos a esta capa no lo tienen y se
   * tratan como activos.
   */
  lastActivityAt?: string | null;
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
  /** Alcance del sprint y trazabilidad del recorte. Opcional (reportes viejos). */
  scope?: SprintScopeMetrics;
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
