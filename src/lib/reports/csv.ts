import type { ReportMetrics, Risk } from "./types";
import type { Locale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/dictionaries";

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
 * by blank lines so it opens cleanly in Excel / Google Sheets. Localized via the
 * optional `locale` (defaults to Spanish for callers that don't pass one).
 */
export function buildReportCsv(report: ReportLike, locale: Locale = "es"): string {
  const t = makeT(locale);
  const m = report.metrics as ReportMetrics | null;
  const risks = (report.risks as Risk[] | null) ?? [];
  const recs = (report.recommendations as string[] | null) ?? [];
  const lines: string[] = [];

  const d = (v: Date | string) =>
    new Date(v).toLocaleDateString(locale === "en" ? "en-US" : "es-AR");

  lines.push(row(t("exp.teamReport")));
  lines.push(row(t("exp.period"), `${d(report.periodStart)} - ${d(report.periodEnd)}`));
  lines.push(
    row(
      t("exp.healthStatus"),
      report.healthStatus ? t(`lib.health.${report.healthStatus}`) : "",
    ),
  );
  lines.push(row(t("exp.summary"), report.summary ?? ""));
  lines.push("");

  if (m) {
    lines.push(row(t("exp.metrics")));
    lines.push(row(t("exp.metric"), t("exp.value")));
    lines.push(row(t("exp.committedPoints"), m.capacity.committedPoints));
    lines.push(row(t("exp.completedPoints"), m.capacity.completedPoints));
    lines.push(row(t("exp.velocity"), m.capacity.velocityPoints));
    lines.push(row(t("exp.remainingPoints"), m.capacity.remainingPoints));
    lines.push(row(t("exp.cycleTimeDays"), m.capacity.cycleTimeAvgDays ?? ""));
    lines.push(row(t("exp.completionByPoints"), m.projectProgress.completionByPoints));
    lines.push(row(t("exp.completionByCount"), m.projectProgress.completionByCount));
    lines.push(row(t("exp.tasksDone"), m.workItems.done));
    lines.push(row(t("exp.tasksInProgress"), m.workItems.inProgress));
    lines.push(row(t("exp.tasksBlocked"), m.workItems.blocked));
    lines.push(row(t("exp.tasksStale"), m.workItems.stale));
    lines.push(row(t("exp.tasksCritical"), m.workItems.critical));
    lines.push(row(t("exp.prOpen"), m.codeChanges.open));
    lines.push(row(t("exp.prMerged"), m.codeChanges.merged));
    lines.push(row(t("exp.prWithoutReviewer"), m.codeChanges.withoutReviewer));
    lines.push(row(t("exp.prOld"), m.codeChanges.old));
    lines.push(row(t("exp.carryOverPoints"), m.planning.carryOverPoints));
    lines.push(row(t("exp.forecastPoints"), m.planning.forecastPoints));
    if (m.quality) {
      lines.push(row(t("exp.bugsTotal"), m.quality.bugs));
      lines.push(row(t("exp.bugsOpen"), m.quality.bugsOpen));
      lines.push(row(t("exp.defectRate"), m.quality.defectRatePct));
      lines.push(row(t("exp.scopeCreep"), m.quality.scopeCreepPct));
      lines.push(row(t("exp.readyForQa"), m.quality.readyForQa));
    }
    if (m.ci) {
      lines.push(row(t("exp.ciTotal"), m.ci.total));
      lines.push(row(t("exp.ciFailed"), m.ci.failed));
      lines.push(row(t("exp.ciFailureRate"), m.ci.failureRatePct));
      lines.push(row(t("exp.deployFailed"), m.ci.deployFailed));
    }
    lines.push("");

    if (m.people.length > 0) {
      lines.push(row(t("exp.perPerson")));
      lines.push(
        row(
          t("exp.colRanking"),
          t("exp.colPerson"),
          t("exp.colSignal"),
          t("exp.colScore"),
          t("exp.colCompletedPoints"),
          t("exp.colDone"),
          t("exp.colInProgress"),
          t("exp.colBlocked"),
          t("exp.colPrOpen"),
          t("exp.colPrMerged"),
        ),
      );
      for (const p of m.people) {
        lines.push(
          row(
            p.rank,
            p.name,
            t(`lib.personCategory.${p.category}`),
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
    lines.push(row(t("exp.risks")));
    lines.push(row(t("exp.colLevel"), t("exp.colTitle"), t("exp.colDetail")));
    for (const r of risks) lines.push(row(r.level, r.title, r.detail));
    lines.push("");
  }

  if (recs.length > 0) {
    lines.push(row(t("exp.recommendations")));
    for (const r of recs) lines.push(row(r));
  }

  return lines.join("\n");
}
