import type {
  HealthLevel,
  ReportHighlights,
  ReportMetrics,
  Risk,
} from "./types";
import { makeT, type TFunc } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/utils";

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  HEALTHY: "Saludable",
  MEDIUM_RISK: "Riesgo medio",
  HIGH_RISK: "Riesgo alto",
};

function fmtDate(d: Date): string {
  return formatDate(d);
}

export function buildMarkdown(input: {
  periodStart: Date;
  periodEnd: Date;
  healthStatus: HealthLevel;
  summary: string;
  metrics: ReportMetrics;
  risks: Risk[];
  recommendations: string[];
  highlights: ReportHighlights;
  /** Traducción; por defecto español (para llamadas legacy / serializers). */
  t?: TFunc;
  locale?: Locale;
}): string {
  const { metrics: m, highlights: h } = input;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const t = input.t ?? makeT(locale);
  const lines: string[] = [];

  lines.push(`# ${t("gen.md.title")}`);
  lines.push("");
  lines.push(
    `**${t("gen.md.period")}:** ${fmtDate(input.periodStart)} ${t("gen.md.periodTo")} ${fmtDate(input.periodEnd)}  `,
  );
  lines.push(
    `**${t("gen.md.overall")}:** ${t(`lib.health.${input.healthStatus}`)}`,
  );
  lines.push("");

  lines.push(`## ${t("gen.md.execSummary")}`);
  lines.push("");
  lines.push(input.summary);
  lines.push("");

  lines.push(`## ${t("gen.md.capacityVelocity")}`);
  lines.push("");
  lines.push(
    `- ${t("gen.md.storyPoints")}: ${m.capacity.completedPoints}/${m.capacity.committedPoints} ${t("gen.md.completedSuffix")} (${m.projectProgress.completionByPoints}%)`,
  );
  lines.push(`- ${t("gen.md.periodVelocity")}: ${m.capacity.velocityPoints} pts`);
  lines.push(`- ${t("gen.md.remainingPoints")}: ${m.capacity.remainingPoints} pts`);
  if (m.capacity.cycleTimeAvgDays != null)
    lines.push(
      `- ${t("gen.md.avgCycleTime")}: ${m.capacity.cycleTimeAvgDays} ${t("gen.md.days")}`,
    );
  lines.push(
    `- ${t("gen.md.projectProgress")}: ${m.projectProgress.doneItems}/${m.projectProgress.totalItems} ${t("gen.md.tasks")} (${m.projectProgress.completionByCount}%)`,
  );
  lines.push("");

  lines.push(`## ${t("gen.md.mainMetrics")}`);
  lines.push("");
  lines.push(`- ${t("gen.md.tasksDone")}: ${m.workItems.done}`);
  lines.push(`- ${t("gen.md.tasksInProgress")}: ${m.workItems.inProgress}`);
  lines.push(`- ${t("gen.md.tasksBlocked")}: ${m.workItems.blocked}`);
  lines.push(`- ${t("gen.md.tasksStale")}: ${m.workItems.stale}`);
  lines.push(`- ${t("gen.md.tasksCritical")}: ${m.workItems.critical}`);
  lines.push(`- ${t("gen.md.prsOpen")}: ${m.codeChanges.open}`);
  lines.push(`- ${t("gen.md.prsMerged")}: ${m.codeChanges.merged}`);
  lines.push(`- ${t("gen.md.prsNoReviewer")}: ${m.codeChanges.withoutReviewer}`);
  lines.push(`- ${t("gen.md.prsOld")}: ${m.codeChanges.old}`);
  if (m.activity.messages > 0)
    lines.push(`- ${t("gen.md.possibleBlockers")}: ${m.activity.blockers}`);
  lines.push("");

  if (h.tasksDone.length > 0) {
    lines.push(`## ${t("gen.md.sectionTasksDone")}`);
    lines.push("");
    for (const it of h.tasksDone)
      lines.push(`- ${it.externalId} — ${it.title}${it.meta ? ` (${it.meta})` : ""}`);
    lines.push("");
  }

  if (h.tasksAtRisk.length > 0) {
    lines.push(`## ${t("gen.md.sectionTasksAtRisk")}`);
    lines.push("");
    for (const it of h.tasksAtRisk)
      lines.push(`- ${it.externalId} — ${it.title}${it.meta ? ` (${it.meta})` : ""}`);
    lines.push("");
  }

  if (h.prsMerged.length > 0) {
    lines.push(`## ${t("gen.md.sectionPrsMerged")}`);
    lines.push("");
    for (const p of h.prsMerged)
      lines.push(`- ${p.externalId} — ${p.title}${p.meta ? ` (${p.meta})` : ""}`);
    lines.push("");
  }

  if (h.prsAtRisk.length > 0) {
    lines.push(`## ${t("gen.md.sectionPrsAtRisk")}`);
    lines.push("");
    for (const p of h.prsAtRisk)
      lines.push(`- ${p.externalId} — ${p.title}${p.meta ? ` (${p.meta})` : ""}`);
    lines.push("");
  }

  if (input.risks.length > 0) {
    lines.push(`## ${t("gen.md.risksDetected")}`);
    lines.push("");
    for (const r of input.risks)
      lines.push(`- [${r.level.toUpperCase()}] ${r.title} — ${r.detail}`);
    lines.push("");
  }

  lines.push(`## ${t("gen.md.recommendations")}`);
  lines.push("");
  for (const r of input.recommendations) lines.push(`- ${r}`);
  lines.push("");

  lines.push(`## ${t("gen.md.planningInputs")}`);
  lines.push("");
  lines.push(
    `- ${t("gen.md.carryOver", { items: m.planning.carryOverItems, points: m.planning.carryOverPoints })}`,
  );
  lines.push(
    `- ${t("gen.md.forecast", { points: m.planning.forecastPoints })}`,
  );
  if (m.planning.focus.length > 0) {
    lines.push(`- ${t("gen.md.recommendedFocus")}:`);
    for (const f of m.planning.focus)
      lines.push(`  - ${f.externalId} — ${f.title} (${f.reason})`);
  }
  lines.push("");

  if (m.people.length > 0) {
    lines.push(`## ${t("gen.md.byPerson")}`);
    lines.push("");
    lines.push(`> ${t("gen.md.peopleNote")}`);
    lines.push("");
    lines.push(
      `| # | ${t("gen.md.thPerson")} | ${t("gen.md.thSignal")} | ${t("gen.md.thDone")} | ${t("gen.md.thSpCompleted")} | ${t("gen.md.thInProgress")} | ${t("gen.md.thBlocked")} | ${t("gen.md.thPrMerged")} | ${t("gen.md.thScore")} |`,
    );
    lines.push(`|---|---|---|---|---|---|---|---|---|`);
    for (const p of m.people)
      lines.push(
        `| ${p.rank} | ${p.name} | ${t(`lib.personCategory.${p.category}`)} | ${p.tasksDone} | ${p.completedPoints} | ${p.tasksInProgress} | ${p.tasksBlocked} | ${p.prsMerged} | ${p.score} |`,
      );
    lines.push("");
  }

  return lines.join("\n");
}
