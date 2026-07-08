import type { ReportMetrics, Risk } from "./types";

interface ReportLike {
  periodStart: Date | string;
  periodEnd: Date | string;
  healthStatus: string | null;
  summary: string | null;
  metrics: unknown;
  risks: unknown;
  recommendations: unknown;
}

function esc(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(...cells: unknown[]): string {
  return cells.map(esc).join(",");
}

/**
 * Builds a CSV representation of a report. Multiple labelled sections separated
 * by blank lines so it opens cleanly in Excel / Google Sheets.
 */
export function buildReportCsv(report: ReportLike): string {
  const m = report.metrics as ReportMetrics | null;
  const risks = (report.risks as Risk[] | null) ?? [];
  const recs = (report.recommendations as string[] | null) ?? [];
  const lines: string[] = [];

  const d = (v: Date | string) => new Date(v).toLocaleDateString();

  lines.push(row("Reporte del equipo"));
  lines.push(row("Período", `${d(report.periodStart)} - ${d(report.periodEnd)}`));
  lines.push(row("Estado de salud", report.healthStatus ?? ""));
  lines.push(row("Resumen", report.summary ?? ""));
  lines.push("");

  if (m) {
    lines.push(row("Métricas"));
    lines.push(row("Métrica", "Valor"));
    lines.push(row("Story points comprometidos", m.capacity.committedPoints));
    lines.push(row("Story points completados", m.capacity.completedPoints));
    lines.push(row("Velocity", m.capacity.velocityPoints));
    lines.push(row("Puntos restantes", m.capacity.remainingPoints));
    lines.push(row("Cycle time (días)", m.capacity.cycleTimeAvgDays ?? ""));
    lines.push(row("Avance por SP (%)", m.projectProgress.completionByPoints));
    lines.push(row("Avance por tareas (%)", m.projectProgress.completionByCount));
    lines.push(row("Tareas finalizadas", m.workItems.done));
    lines.push(row("Tareas en progreso", m.workItems.inProgress));
    lines.push(row("Tareas bloqueadas", m.workItems.blocked));
    lines.push(row("Tareas sin movimiento", m.workItems.stale));
    lines.push(row("Tareas críticas", m.workItems.critical));
    lines.push(row("PR/MR abiertos", m.codeChanges.open));
    lines.push(row("PR/MR mergeados", m.codeChanges.merged));
    lines.push(row("PR/MR sin reviewer", m.codeChanges.withoutReviewer));
    lines.push(row("PR/MR > 72h", m.codeChanges.old));
    lines.push(row("Carry-over (puntos)", m.planning.carryOverPoints));
    lines.push(row("Forecast (puntos)", m.planning.forecastPoints));
    if (m.quality) {
      lines.push(row("Bugs (total)", m.quality.bugs));
      lines.push(row("Bugs abiertos", m.quality.bugsOpen));
      lines.push(row("Defect rate (%)", m.quality.defectRatePct));
      lines.push(row("Scope creep (%)", m.quality.scopeCreepPct));
      lines.push(row("Listas para QA/demo", m.quality.readyForQa));
    }
    if (m.ci) {
      lines.push(row("CI corridas", m.ci.total));
      lines.push(row("CI fallidas", m.ci.failed));
      lines.push(row("CI tasa de fallo (%)", m.ci.failureRatePct));
      lines.push(row("Deploys fallidos", m.ci.deployFailed));
    }
    lines.push("");

    if (m.people.length > 0) {
      lines.push(row("Por persona"));
      lines.push(
        row(
          "Ranking",
          "Persona",
          "Señal",
          "Score",
          "SP completados",
          "Finalizadas",
          "En progreso",
          "Bloqueadas",
          "PR abiertos",
          "PR mergeados",
        ),
      );
      for (const p of m.people) {
        lines.push(
          row(
            p.rank,
            p.name,
            p.category,
            p.score,
            p.completedPoints,
            p.tasksDone,
            p.tasksInProgress,
            p.tasksBlocked,
            p.prsOpen,
            p.prsMerged,
          ),
        );
      }
      lines.push("");
    }
  }

  if (risks.length > 0) {
    lines.push(row("Riesgos"));
    lines.push(row("Nivel", "Título", "Detalle"));
    for (const r of risks) lines.push(row(r.level, r.title, r.detail));
    lines.push("");
  }

  if (recs.length > 0) {
    lines.push(row("Recomendaciones"));
    for (const r of recs) lines.push(row(r));
  }

  return lines.join("\n");
}
