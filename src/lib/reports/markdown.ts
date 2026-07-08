import type {
  HealthLevel,
  ReportHighlights,
  ReportMetrics,
  Risk,
} from "./types";
import { PERSON_CATEGORY_LABEL } from "./labels";

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  HEALTHY: "Saludable",
  MEDIUM_RISK: "Riesgo medio",
  HIGH_RISK: "Riesgo alto",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
}): string {
  const { metrics: m, highlights: h } = input;
  const lines: string[] = [];

  lines.push(`# Reporte semanal del equipo`);
  lines.push("");
  lines.push(
    `**Período:** ${fmtDate(input.periodStart)} al ${fmtDate(input.periodEnd)}  `,
  );
  lines.push(`**Estado general:** ${HEALTH_LABEL[input.healthStatus]}`);
  lines.push("");

  lines.push(`## Resumen ejecutivo`);
  lines.push("");
  lines.push(input.summary);
  lines.push("");

  lines.push(`## Capacidad y velocity`);
  lines.push("");
  lines.push(
    `- Story points: ${m.capacity.completedPoints}/${m.capacity.committedPoints} completados (${m.projectProgress.completionByPoints}%)`,
  );
  lines.push(`- Velocity del período: ${m.capacity.velocityPoints} pts`);
  lines.push(`- Puntos restantes: ${m.capacity.remainingPoints} pts`);
  if (m.capacity.cycleTimeAvgDays != null)
    lines.push(`- Cycle time promedio: ${m.capacity.cycleTimeAvgDays} días`);
  lines.push(
    `- Avance del proyecto: ${m.projectProgress.doneItems}/${m.projectProgress.totalItems} tareas (${m.projectProgress.completionByCount}%)`,
  );
  lines.push("");

  lines.push(`## Métricas principales`);
  lines.push("");
  lines.push(`- Tareas finalizadas: ${m.workItems.done}`);
  lines.push(`- Tareas en progreso: ${m.workItems.inProgress}`);
  lines.push(`- Tareas bloqueadas: ${m.workItems.blocked}`);
  lines.push(`- Tareas sin movimiento: ${m.workItems.stale}`);
  lines.push(`- Tareas críticas: ${m.workItems.critical}`);
  lines.push(`- PR/MR abiertos: ${m.codeChanges.open}`);
  lines.push(`- PR/MR mergeados: ${m.codeChanges.merged}`);
  lines.push(`- PR/MR sin reviewer: ${m.codeChanges.withoutReviewer}`);
  lines.push(`- PR/MR abiertos > 72h: ${m.codeChanges.old}`);
  if (m.activity.messages > 0)
    lines.push(`- Posibles blockers (Slack): ${m.activity.blockers}`);
  lines.push("");

  if (h.tasksDone.length > 0) {
    lines.push(`## Tareas finalizadas`);
    lines.push("");
    for (const t of h.tasksDone)
      lines.push(`- ${t.externalId} — ${t.title}${t.meta ? ` (${t.meta})` : ""}`);
    lines.push("");
  }

  if (h.tasksAtRisk.length > 0) {
    lines.push(`## Tareas en riesgo`);
    lines.push("");
    for (const t of h.tasksAtRisk)
      lines.push(`- ${t.externalId} — ${t.title}${t.meta ? ` (${t.meta})` : ""}`);
    lines.push("");
  }

  if (h.prsMerged.length > 0) {
    lines.push(`## Pull/Merge Requests mergeados`);
    lines.push("");
    for (const p of h.prsMerged)
      lines.push(`- ${p.externalId} — ${p.title}${p.meta ? ` (${p.meta})` : ""}`);
    lines.push("");
  }

  if (h.prsAtRisk.length > 0) {
    lines.push(`## Pull/Merge Requests con riesgo`);
    lines.push("");
    for (const p of h.prsAtRisk)
      lines.push(`- ${p.externalId} — ${p.title}${p.meta ? ` (${p.meta})` : ""}`);
    lines.push("");
  }

  if (input.risks.length > 0) {
    lines.push(`## Riesgos detectados`);
    lines.push("");
    for (const r of input.risks)
      lines.push(`- [${r.level.toUpperCase()}] ${r.title} — ${r.detail}`);
    lines.push("");
  }

  lines.push(`## Recomendaciones`);
  lines.push("");
  for (const r of input.recommendations) lines.push(`- ${r}`);
  lines.push("");

  lines.push(`## Insumos para el próximo planning`);
  lines.push("");
  lines.push(`- Carry-over: ${m.planning.carryOverItems} tarea(s) sin terminar (${m.planning.carryOverPoints} pts)`);
  lines.push(`- Forecast de capacidad: ~${m.planning.forecastPoints} pts para el próximo período`);
  if (m.planning.focus.length > 0) {
    lines.push(`- Foco recomendado:`);
    for (const f of m.planning.focus)
      lines.push(`  - ${f.externalId} — ${f.title} (${f.reason})`);
  }
  lines.push("");

  if (m.people.length > 0) {
    lines.push(`## Por persona (señales para conversar)`);
    lines.push("");
    lines.push(
      `> Estas métricas son proxies (no todo el trabajo se ticketea; los story points varían). Usalas como punto de partida para conversar, no como puntaje absoluto.`,
    );
    lines.push("");
    lines.push(`| # | Persona | Señal | Finalizadas | SP compl. | En progreso | Bloqueadas | PR merg. | Score |`);
    lines.push(`|---|---|---|---|---|---|---|---|---|`);
    for (const p of m.people)
      lines.push(
        `| ${p.rank} | ${p.name} | ${PERSON_CATEGORY_LABEL[p.category]} | ${p.tasksDone} | ${p.completedPoints} | ${p.tasksInProgress} | ${p.tasksBlocked} | ${p.prsMerged} | ${p.score} |`,
      );
    lines.push("");
  }

  return lines.join("\n");
}
