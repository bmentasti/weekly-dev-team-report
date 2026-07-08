import { prisma } from "@/lib/prisma";
import { getProviderByType, type ProviderSlug } from "@/lib/integrations/catalog";
import { getAdapter } from "@/lib/integrations/registry";
import { loadConnectionContext } from "@/lib/integrations/loader";
import type {
  ActivitySignal,
  CiRun,
  UnifiedCodeChange,
  UnifiedWorkItem,
} from "@/lib/integrations/types";
import type {
  HealthLevel,
  PersonCategory,
  PersonInsight,
  ReportComputation,
  Risk,
  TrendPoint,
} from "./types";
import { buildMarkdown } from "./markdown";

const OVERLOAD_WIP = 5;

interface CollectedData {
  workItems: UnifiedWorkItem[];
  codeChanges: UnifiedCodeChange[];
  activity: ActivitySignal[];
  ciRuns: CiRun[];
  sources: ProviderSlug[];
  sourcesWithError: ProviderSlug[];
}

async function collect(
  projectId: string,
  periodStart: Date,
): Promise<CollectedData> {
  const integrations = await prisma.integration.findMany({
    where: { projectId, status: "CONNECTED" },
  });

  const out: CollectedData = {
    workItems: [],
    codeChanges: [],
    activity: [],
    ciRuns: [],
    sources: [],
    sourcesWithError: [],
  };

  const since = periodStart.toISOString();

  await Promise.all(
    integrations.map(async (integration) => {
      const entry = getProviderByType(integration.type);
      if (!entry || !entry.enabled) return;
      const adapter = getAdapter(entry.slug);
      if (!adapter) return;
      const loaded = await loadConnectionContext(projectId, integration.type);
      if (!loaded) return;
      try {
        const data = await adapter.fetchData(loaded.ctx, { since });
        if (data.workItems) out.workItems.push(...data.workItems);
        if (data.codeChanges) out.codeChanges.push(...data.codeChanges);
        if (data.activity) out.activity.push(...data.activity);
        if (data.ciRuns) out.ciRuns.push(...data.ciRuns);
        out.sources.push(entry.slug);
      } catch {
        out.sourcesWithError.push(entry.slug);
        await prisma.integration
          .update({ where: { id: integration.id }, data: { status: "ERROR" } })
          .catch(() => undefined);
      }
    }),
  );

  return out;
}

const sp = (w: UnifiedWorkItem) => w.storyPoints ?? 0;

function cycleTimeDays(items: UnifiedWorkItem[]): number | null {
  const durations: number[] = [];
  for (const i of items) {
    if (i.bucket === "DONE" && i.createdAt && i.resolvedAt) {
      const d =
        (new Date(i.resolvedAt).getTime() - new Date(i.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (d >= 0) durations.push(d);
    }
  }
  if (durations.length === 0) return null;
  return Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
}

function buildPeople(
  workItems: UnifiedWorkItem[],
  codeChanges: UnifiedCodeChange[],
): PersonInsight[] {
  const map = new Map<string, PersonInsight>();
  const itemsByPerson = new Map<string, UnifiedWorkItem[]>();

  const get = (name: string): PersonInsight => {
    let p = map.get(name);
    if (!p) {
      p = {
        name,
        tasksDone: 0,
        tasksInProgress: 0,
        tasksBlocked: 0,
        tasksStale: 0,
        prsOpen: 0,
        prsMerged: 0,
        committedPoints: 0,
        completedPoints: 0,
        wip: 0,
        throughput: 0,
        cycleTimeAvgDays: null,
        category: "ON_TRACK",
        score: 0,
        rank: 0,
        nextStep: "",
      };
      map.set(name, p);
      itemsByPerson.set(name, []);
    }
    return p;
  };

  for (const w of workItems) {
    if (!w.assignee) continue;
    const p = get(w.assignee);
    itemsByPerson.get(w.assignee)!.push(w);
    if (w.bucket === "DONE") {
      p.tasksDone++;
      p.completedPoints += sp(w);
    } else if (w.bucket === "IN_PROGRESS") p.tasksInProgress++;
    else if (w.bucket === "BLOCKED") p.tasksBlocked++;
    if (w.isStale) p.tasksStale++;
    if (w.bucket !== "TODO") p.committedPoints += sp(w);
  }
  for (const c of codeChanges) {
    if (!c.author) continue;
    const p = get(c.author);
    if (c.state === "OPEN") p.prsOpen++;
    else if (c.state === "MERGED") p.prsMerged++;
  }

  const people = Array.from(map.values());
  for (const p of people) {
    p.wip = p.tasksInProgress;
    p.throughput = p.tasksDone + p.prsMerged;
    p.cycleTimeAvgDays = cycleTimeDays(itemsByPerson.get(p.name) ?? []);
    // Contribution score: completed work + merged code, weighted.
    p.score =
      p.completedPoints * 2 + p.tasksDone * 2 + p.prsMerged * 3 + p.prsOpen;
    // Category (actionability first).
    p.category = categorize(p);
    p.nextStep = nextStepFor(p);
  }

  people.sort((a, b) => b.score - a.score);
  people.forEach((p, i) => (p.rank = i + 1));
  return people;
}

function categorize(p: PersonInsight): PersonCategory {
  if (p.tasksBlocked > 0 || p.tasksStale >= 2) return "SUPPORT";
  if (p.wip >= OVERLOAD_WIP) return "OVERLOADED";
  if (p.throughput >= 3 && p.tasksBlocked === 0 && p.tasksStale === 0)
    return "RECOGNIZE";
  if (p.wip === 0 && p.throughput <= 1 && p.committedPoints <= 2)
    return "FREE_CAPACITY";
  return "ON_TRACK";
}

function nextStepFor(p: PersonInsight): string {
  switch (p.category) {
    case "SUPPORT":
      return "Conversar 1:1 para destrabar bloqueos y priorizar. Ofrecer ayuda o pairing.";
    case "OVERLOADED":
      return "Redistribuir parte del WIP; hay riesgo de cuello de botella y burnout.";
    case "RECOGNIZE":
      return "Reconocer el aporte. Buen candidato/a para mentoría o tareas de mayor impacto.";
    case "FREE_CAPACITY":
      return "Tiene capacidad disponible; asignar trabajo del backlog o revisiones.";
    default:
      return "En ritmo. Mantener seguimiento habitual.";
  }
}

async function buildTrend(
  projectId: string,
  current: TrendPoint,
): Promise<TrendPoint[]> {
  const previous = await prisma.report.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { metrics: true, healthStatus: true, periodEnd: true },
  });

  const points: TrendPoint[] = previous
    .reverse()
    .map((r) => {
      const m = r.metrics as {
        workItems?: { done?: number; blocked?: number };
        codeChanges?: { merged?: number };
        capacity?: { velocityPoints?: number };
      } | null;
      return {
        label: new Date(r.periodEnd).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
        }),
        done: m?.workItems?.done ?? 0,
        merged: m?.codeChanges?.merged ?? 0,
        blocked: m?.workItems?.blocked ?? 0,
        velocityPoints: m?.capacity?.velocityPoints ?? 0,
        health: (r.healthStatus as HealthLevel | null) ?? null,
      };
    });

  points.push(current);
  return points;
}

export async function generateReportComputation(
  projectId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ReportComputation> {
  const data = await collect(projectId, periodStart);
  const { workItems, codeChanges, activity, ciRuns } = data;

  const wi = {
    total: workItems.length,
    done: workItems.filter((i) => i.bucket === "DONE").length,
    inProgress: workItems.filter((i) => i.bucket === "IN_PROGRESS").length,
    blocked: workItems.filter((i) => i.bucket === "BLOCKED").length,
    todo: workItems.filter((i) => i.bucket === "TODO").length,
    stale: workItems.filter((i) => i.isStale).length,
    critical: workItems.filter((i) => i.isCritical).length,
  };

  const openPrs = codeChanges.filter((c) => c.state === "OPEN");
  const cc = {
    total: codeChanges.length,
    open: openPrs.length,
    merged: codeChanges.filter((c) => c.state === "MERGED").length,
    closedNoMerge: codeChanges.filter((c) => c.state === "CLOSED").length,
    withoutReviewer: openPrs.filter((c) => !c.hasReviewer).length,
    checksFailing: openPrs.filter((c) => c.checksState === "failure").length,
    old: openPrs.filter((c) => c.isOld).length,
    avgOpenAgeHours:
      openPrs.length > 0
        ? Math.round(openPrs.reduce((s, c) => s + c.ageHours, 0) / openPrs.length)
        : 0,
  };

  const blockers = activity.filter((a) => a.isBlocker);
  const act = {
    messages: activity.length,
    blockers: blockers.length,
    activePeople: new Set(activity.map((a) => a.author).filter(Boolean)).size,
  };

  // ---- Calidad (Etapa 2) ----
  const isBug = (w: UnifiedWorkItem) =>
    /bug|defect|error|inciden/i.test(w.type ?? "") ||
    w.labels.some((l) => /bug|defect/i.test(l));
  const bugItems = workItems.filter(isBug);
  const bugsDone = bugItems.filter((b) => b.bucket === "DONE").length;
  const scopeCreepItems = workItems.filter(
    (w) => w.createdAt && new Date(w.createdAt).getTime() > periodStart.getTime(),
  ).length;
  const readyForQa = workItems.filter(
    (w) => w.bucket !== "DONE" && /qa|review|test|demo|ready|revisi/i.test(w.status),
  ).length;
  const quality = {
    bugs: bugItems.length,
    bugsDone,
    bugsOpen: bugItems.length - bugsDone,
    defectRatePct: wi.total > 0 ? Math.round((bugItems.length / wi.total) * 100) : 0,
    scopeCreepItems,
    scopeCreepPct: wi.total > 0 ? Math.round((scopeCreepItems / wi.total) * 100) : 0,
    readyForQa,
  };

  // ---- CI (Etapa 3) ----
  const ciSuccess = ciRuns.filter((r) => r.status === "success").length;
  const ciFailed = ciRuns.filter((r) => r.status === "failure").length;
  const ciRunning = ciRuns.filter((r) => r.status === "running").length;
  const ciCompleted = ciSuccess + ciFailed;
  const ci = {
    total: ciRuns.length,
    success: ciSuccess,
    failed: ciFailed,
    running: ciRunning,
    failureRatePct: ciCompleted > 0 ? Math.round((ciFailed / ciCompleted) * 100) : 0,
    deployFailed: ciRuns.filter((r) => r.isDeploy && r.status === "failure").length,
  };

  // ---- Capacity & story points ----
  const committedPoints = workItems
    .filter((i) => i.bucket !== "TODO")
    .reduce((s, i) => s + sp(i), 0);
  const completedPoints = workItems
    .filter((i) => i.bucket === "DONE")
    .reduce((s, i) => s + sp(i), 0);
  const capacity = {
    committedPoints,
    completedPoints,
    velocityPoints: completedPoints,
    remainingPoints: Math.max(committedPoints - completedPoints, 0),
    cycleTimeAvgDays: cycleTimeDays(workItems),
  };

  const statusDistribution = {
    todo: wi.todo,
    inProgress: wi.inProgress,
    blocked: wi.blocked,
    done: wi.done,
  };

  const totalPoints = workItems.reduce((s, i) => s + sp(i), 0);
  const projectProgress = {
    totalItems: wi.total,
    doneItems: wi.done,
    remainingItems: wi.total - wi.done,
    completionByCount: wi.total > 0 ? Math.round((wi.done / wi.total) * 100) : 0,
    completionByPoints:
      totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
  };

  const people = buildPeople(workItems, codeChanges);

  // ---- Risks ----
  const risks: Risk[] = [];
  const criticalStale = workItems.filter((i) => i.isCritical && i.isStale);
  if (criticalStale.length > 0)
    risks.push({
      level: "high",
      title: `${criticalStale.length} tarea(s) crítica(s) sin movimiento`,
      detail: criticalStale.slice(0, 5).map((i) => i.externalId).join(", "),
    });
  if (wi.blocked > 0)
    risks.push({
      level: wi.blocked >= 3 ? "high" : "medium",
      title: `${wi.blocked} tarea(s) bloqueada(s)`,
      detail: workItems
        .filter((i) => i.bucket === "BLOCKED")
        .slice(0, 5)
        .map((i) => i.externalId)
        .join(", "),
    });
  if (cc.old > 0)
    risks.push({
      level: cc.old >= 3 ? "high" : "medium",
      title: `${cc.old} PR/MR abierto(s) hace más de 72h`,
      detail: "Acumulación de trabajo pendiente de merge.",
    });
  if (cc.withoutReviewer > 0)
    risks.push({
      level: "medium",
      title: `${cc.withoutReviewer} PR/MR sin reviewer`,
      detail: "Hay cambios abiertos sin nadie asignado para revisarlos.",
    });
  if (cc.checksFailing > 0)
    risks.push({
      level: "medium",
      title: `${cc.checksFailing} PR/MR con checks fallando`,
      detail: "Tests o CI en rojo en cambios abiertos.",
    });
  const overloaded = people.filter((p) => p.category === "OVERLOADED");
  for (const p of overloaded.slice(0, 3))
    risks.push({
      level: "medium",
      title: `Posible sobrecarga: ${p.name}`,
      detail: `${p.wip} tareas en progreso asignadas.`,
    });
  if (act.blockers > 0)
    risks.push({
      level: "medium",
      title: `${act.blockers} posible(s) blocker(s) mencionado(s) en Slack`,
      detail: "Revisar la conversación reciente del equipo.",
    });

  // ---- Health ----
  let score = 0;
  score += wi.blocked >= 3 ? 2 : wi.blocked > 0 ? 1 : 0;
  score += criticalStale.length > 0 ? 2 : 0;
  score += cc.old >= 3 ? 2 : cc.old > 0 ? 1 : 0;
  score += cc.withoutReviewer >= 3 ? 1 : 0;
  score += cc.checksFailing > 0 ? 1 : 0;
  score += overloaded.length > 0 ? 1 : 0;
  if (capacity.committedPoints > 0 && capacity.completedPoints === 0) score += 1;
  const healthStatus: HealthLevel =
    score >= 4 ? "HIGH_RISK" : score >= 2 ? "MEDIUM_RISK" : "HEALTHY";

  // ---- Trend ----
  const trend = await buildTrend(projectId, {
    label: "Actual",
    done: wi.done,
    merged: cc.merged,
    blocked: wi.blocked,
    velocityPoints: completedPoints,
    health: healthStatus,
  });

  // ---- Planning ----
  const carryOver = workItems.filter((i) => i.bucket !== "DONE");
  const velocities = trend.map((t) => t.velocityPoints).filter((v) => v > 0);
  const forecastPoints =
    velocities.length > 0
      ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length)
      : completedPoints;
  const planning = {
    carryOverItems: carryOver.length,
    carryOverPoints: carryOver.reduce((s, i) => s + sp(i), 0),
    forecastPoints,
    focus: workItems
      .filter((i) => i.bucket === "BLOCKED" || (i.isCritical && i.isStale))
      .slice(0, 6)
      .map((i) => ({
        externalId: i.externalId,
        title: i.title,
        url: i.url,
        reason:
          i.bucket === "BLOCKED"
            ? "Bloqueada"
            : "Crítica sin movimiento",
      })),
  };

  // ---- Recommendations ----
  const recommendations: string[] = [];
  if (cc.withoutReviewer > 0 || cc.old > 0)
    recommendations.push(
      "Asignar reviewers y destrabar los PR/MR pendientes de review.",
    );
  if (wi.blocked > 0 || criticalStale.length > 0)
    recommendations.push(
      "Revisar tareas bloqueadas y críticas sin movimiento en la próxima daily.",
    );
  if (cc.checksFailing > 0)
    recommendations.push("Arreglar los checks/CI que están fallando.");
  if (overloaded.length > 0)
    recommendations.push(
      `Balancear la carga: ${overloaded.map((p) => p.name).join(", ")} con WIP alto.`,
    );
  if (people.some((p) => p.category === "FREE_CAPACITY"))
    recommendations.push(
      "Hay personas con capacidad libre; asignarles trabajo del backlog.",
    );
  if (healthStatus === "HIGH_RISK")
    recommendations.push(
      "Confirmar si el alcance del sprint sigue siendo realista.",
    );
  if (recommendations.length === 0)
    recommendations.push(
      "El avance es saludable. Mantener el ritmo y seguimiento actual.",
    );

  // ---- Executive summary ----
  const healthLabel =
    healthStatus === "HEALTHY"
      ? "saludable"
      : healthStatus === "MEDIUM_RISK"
        ? "con riesgo medio"
        : "con riesgo alto";
  const summaryParts: string[] = [
    `El equipo completó ${completedPoints} de ${committedPoints} story points (${projectProgress.completionByPoints}%), cerró ${wi.done} tarea(s) y mergeó ${cc.merged} PR/MR. Estado general ${healthLabel}.`,
  ];
  const concerns: string[] = [];
  if (criticalStale.length > 0)
    concerns.push(`${criticalStale.length} crítica(s) sin movimiento`);
  if (wi.blocked > 0) concerns.push(`${wi.blocked} bloqueada(s)`);
  if (cc.old > 0) concerns.push(`${cc.old} PR/MR viejo(s)`);
  if (cc.withoutReviewer > 0) concerns.push(`${cc.withoutReviewer} sin reviewer`);
  if (concerns.length > 0)
    summaryParts.push(`Puntos de atención: ${concerns.join(", ")}.`);
  const summary = summaryParts.join(" ");

  // ---- Highlights ----
  const toHighlight = (i: UnifiedWorkItem) => ({
    externalId: i.externalId,
    title: i.title,
    url: i.url,
    meta: i.assignee ?? undefined,
  });
  const toPrHighlight = (c: UnifiedCodeChange) => ({
    externalId: `#${c.externalId}`,
    title: c.title,
    url: c.url,
    meta: c.author ?? undefined,
  });
  const highlights = {
    tasksDone: workItems.filter((i) => i.bucket === "DONE").slice(0, 10).map(toHighlight),
    tasksAtRisk: workItems
      .filter((i) => i.bucket === "BLOCKED" || i.isStale)
      .slice(0, 10)
      .map(toHighlight),
    prsMerged: codeChanges.filter((c) => c.state === "MERGED").slice(0, 10).map(toPrHighlight),
    prsAtRisk: codeChanges
      .filter((c) => c.isRisk || (c.state === "OPEN" && !c.hasReviewer))
      .slice(0, 10)
      .map(toPrHighlight),
  };

  const metrics = {
    workItems: wi,
    codeChanges: cc,
    activity: act,
    quality,
    ci,
    capacity,
    projectProgress,
    statusDistribution,
    planning,
    trend,
    people: people.slice(0, 25),
    sources: data.sources,
  };

  const markdown = buildMarkdown({
    periodStart,
    periodEnd,
    healthStatus,
    summary,
    metrics,
    risks,
    recommendations,
    highlights,
  });

  return {
    healthStatus,
    summary,
    metrics,
    risks,
    recommendations,
    highlights,
    markdown,
    sourcesWithError: data.sourcesWithError,
  };
}
