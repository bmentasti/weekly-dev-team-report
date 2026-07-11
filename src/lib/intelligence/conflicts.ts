// Detección de contradicciones — "Data Conflicts" (Etapa 2).
// Detecta inconsistencias entre fuentes, aplica autoridad y propone acción.
import type { WorkGroup } from "./correlation";
import { resolveAuthority } from "./authority";

export type ConflictSeverity = "low" | "medium" | "high" | "critical";
export type ConflictStatus =
  | "DETECTED"
  | "IN_REVIEW"
  | "RESOLVED_AUTO"
  | "RESOLVED_MANUAL"
  | "IGNORED"
  | "RECURRING";

export interface DataConflict {
  type: string;
  severity: ConflictSeverity;
  entities: string[];
  sources: string[];
  conflictingValues: { source: string; value: string }[];
  prioritySource: string | null;
  ruleApplied: string;
  confidence: number;
  recommendedAction: string;
  status: ConflictStatus;
  detectedAt: string;
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * Conflictos derivados de un WorkGroup correlacionado:
 * - tarea cerrada sin PR
 * - PR mergeado con tarea abierta
 * - PR con checks fallando en tarea marcada como hecha
 */
export function detectWorkConflicts(groups: WorkGroup[]): DataConflict[] {
  const conflicts: DataConflict[] = [];

  for (const g of groups) {
    if (!g.key) continue;
    const workItems = g.signals.filter((s) => s.kind === "work_item");
    const codeChanges = g.signals.filter((s) => s.kind === "code_change");
    if (workItems.length === 0) continue;

    const wi = workItems[0];
    const sources = Array.from(new Set(g.signals.map((s) => s.source)));
    const priority = resolveAuthority("task_status", sources);
    const isDone = wi.bucket === "DONE";
    const hasMerged = codeChanges.some((c) => c.codeState === "MERGED");
    const hasOpenCode = codeChanges.some((c) => c.codeState === "OPEN");

    // Tarea cerrada sin evidencia de código
    if (isDone && codeChanges.length === 0) {
      conflicts.push({
        type: "done_without_code",
        severity: "medium",
        entities: [g.key],
        sources,
        conflictingValues: [{ source: wi.source, value: "DONE" }, { source: "code", value: "sin PR" }],
        prioritySource: priority,
        ruleApplied: "Autoridad de estado = gestor de tareas; alertar falta de trazabilidad",
        confidence: g.confidence,
        recommendedAction: "Verificar si el trabajo tiene código asociado o revisar la trazabilidad del ticket.",
        status: "DETECTED",
        detectedAt: nowISO(),
      });
    }

    // Código mergeado pero tarea abierta
    if (hasMerged && !isDone) {
      conflicts.push({
        type: "merged_task_open",
        severity: "medium",
        entities: [g.key],
        sources,
        conflictingValues: [
          { source: wi.source, value: wi.bucket ?? "OPEN" },
          { source: "code", value: "MERGED" },
        ],
        prioritySource: priority,
        ruleApplied: "Estado autoritativo = gestor de tareas; sugerir cerrar el ticket",
        confidence: g.confidence,
        recommendedAction: "Cerrar el ticket si el trabajo ya está mergeado, o confirmar que resta trabajo.",
        status: "DETECTED",
        detectedAt: nowISO(),
      });
    }

    // Tarea "hecha" con PR con checks fallando
    if (isDone && codeChanges.some((c) => c.checksFailing)) {
      conflicts.push({
        type: "done_with_failing_checks",
        severity: "high",
        entities: [g.key],
        sources,
        conflictingValues: [
          { source: wi.source, value: "DONE" },
          { source: "code", value: "checks fallando" },
        ],
        prioritySource: priority,
        ruleApplied: "Calidad prevalece: 'hecho' con checks rojos es riesgo",
        confidence: g.confidence,
        recommendedAction: "Revisar los checks fallidos antes de dar el trabajo por terminado.",
        status: "DETECTED",
        detectedAt: nowISO(),
      });
    }

    // PR abierto con tarea cerrada (código pendiente)
    if (isDone && hasOpenCode) {
      conflicts.push({
        type: "done_with_open_pr",
        severity: "medium",
        entities: [g.key],
        sources,
        conflictingValues: [
          { source: wi.source, value: "DONE" },
          { source: "code", value: "PR abierto" },
        ],
        prioritySource: priority,
        ruleApplied: "Hay código sin mergear para un ticket cerrado",
        confidence: g.confidence,
        recommendedAction: "Mergear o cerrar el PR pendiente, o reabrir el ticket.",
        status: "DETECTED",
        detectedAt: nowISO(),
      });
    }
  }

  return conflicts;
}

/** Contexto operativo para conflictos cross-fuente (release, capacidad, prod). */
export interface OperationalContext {
  entity: string; // proyecto / release / persona
  sourcesPresent: string[];
  pipelineSuccess?: boolean;
  deploymentFailed?: boolean;
  releaseDone?: boolean;
  prodCriticalErrors?: number;
  hrAvailable?: boolean;
  calendarOnLeave?: boolean;
  capacityDeclaredPct?: number;
  capacityActualPct?: number;
  jiraHealthy?: boolean;
  criticalIncidents?: number;
  featureDone?: boolean;
  hasTests?: boolean;
  milestonePct?: number;
  deliverablesDonePct?: number;
}

export function detectOperationalConflicts(ctx: OperationalContext): DataConflict[] {
  const c: DataConflict[] = [];
  const base = (partial: Omit<DataConflict, "status" | "detectedAt" | "entities">) =>
    c.push({ ...partial, entities: [ctx.entity], status: "DETECTED", detectedAt: nowISO() });

  if (ctx.pipelineSuccess === true && ctx.deploymentFailed === true) {
    base({
      type: "pipeline_ok_deploy_failed",
      severity: "high",
      sources: ctx.sourcesPresent,
      conflictingValues: [{ source: "ci", value: "success" }, { source: "deploy", value: "failed" }],
      prioritySource: resolveAuthority("deployment", ctx.sourcesPresent),
      ruleApplied: "Autoridad de deploy = plataforma de deploy; build verde ≠ release ok",
      confidence: 90,
      recommendedAction: "Revisar el deployment; el build exitoso no garantiza la publicación.",
    });
  }

  if (ctx.releaseDone === true && (ctx.prodCriticalErrors ?? 0) > 0) {
    base({
      type: "release_with_critical_errors",
      severity: "critical",
      sources: ctx.sourcesPresent,
      conflictingValues: [
        { source: "release", value: "publicado" },
        { source: "observability", value: `${ctx.prodCriticalErrors} errores críticos` },
      ],
      prioritySource: resolveAuthority("incidents", ctx.sourcesPresent),
      ruleApplied: "Estabilidad prevalece: bajar release confidence",
      confidence: 88,
      recommendedAction: "Evaluar rollback o hotfix; el release tiene errores críticos en producción.",
    });
  }

  if (ctx.hrAvailable === true && ctx.calendarOnLeave === true) {
    base({
      type: "availability_mismatch",
      severity: "low",
      sources: ctx.sourcesPresent,
      conflictingValues: [{ source: "hr", value: "disponible" }, { source: "calendar", value: "de vacaciones" }],
      prioritySource: resolveAuthority("capacity", ctx.sourcesPresent),
      ruleApplied: "Para el rango de fechas, Calendar es autoritativo sobre disponibilidad",
      confidence: 80,
      recommendedAction: "Actualizar disponibilidad; la persona figura de vacaciones en Calendar.",
    });
  }

  if (
    ctx.capacityDeclaredPct !== undefined &&
    ctx.capacityActualPct !== undefined &&
    ctx.capacityActualPct - ctx.capacityDeclaredPct >= 20
  ) {
    base({
      type: "capacity_overload",
      severity: "high",
      sources: ctx.sourcesPresent,
      conflictingValues: [
        { source: "declarado", value: `${ctx.capacityDeclaredPct}%` },
        { source: "real", value: `${ctx.capacityActualPct}%` },
      ],
      prioritySource: resolveAuthority("capacity", ctx.sourcesPresent),
      ruleApplied: "Time tracking sugiere sobrecarga vs capacidad declarada",
      confidence: 72,
      recommendedAction: "Revisar carga real; hay señales de sobrecarga. Puede requerir validación humana.",
    });
  }

  if (ctx.jiraHealthy === true && (ctx.criticalIncidents ?? 0) > 0) {
    base({
      type: "healthy_but_incidents",
      severity: "high",
      sources: ctx.sourcesPresent,
      conflictingValues: [
        { source: "jira", value: "saludable" },
        { source: "incidents", value: `${ctx.criticalIncidents} incidentes críticos` },
      ],
      prioritySource: resolveAuthority("incidents", ctx.sourcesPresent),
      ruleApplied: "Salud reportada ≠ salud en producción; cruzar con incidentes",
      confidence: 84,
      recommendedAction: "Revisar incidentes; el estado 'saludable' no refleja producción.",
    });
  }

  if (ctx.featureDone === true && ctx.hasTests === false) {
    base({
      type: "feature_done_without_tests",
      severity: "medium",
      sources: ctx.sourcesPresent,
      conflictingValues: [{ source: "tasks", value: "feature terminada" }, { source: "testing", value: "sin tests" }],
      prioritySource: resolveAuthority("coverage", ctx.sourcesPresent),
      ruleApplied: "Feature 'terminada' sin evidencia de testing",
      confidence: 70,
      recommendedAction: "Agregar tests antes de dar la feature por cerrada.",
    });
  }

  if (
    ctx.milestonePct !== undefined &&
    ctx.deliverablesDonePct !== undefined &&
    ctx.milestonePct - ctx.deliverablesDonePct >= 30
  ) {
    base({
      type: "milestone_progress_mismatch",
      severity: "high",
      sources: ctx.sourcesPresent,
      conflictingValues: [
        { source: "plan", value: `${ctx.milestonePct}% avance` },
        { source: "entregables", value: `${ctx.deliverablesDonePct}% completado` },
      ],
      prioritySource: null,
      ruleApplied: "Preferir evidencia de entregables reales sobre % declarado",
      confidence: 75,
      recommendedAction: "Revisar el avance real; el % del plan no coincide con los entregables.",
    });
  }

  return c;
}
