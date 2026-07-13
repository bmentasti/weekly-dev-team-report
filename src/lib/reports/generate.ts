import { prisma } from "@/lib/prisma";
import { getProviderByType, type ProviderSlug } from "@/lib/integrations/catalog";
import { getAdapter } from "@/lib/integrations/registry";
import { loadConnectionContext } from "@/lib/integrations/loader";
import {
  demoDataFor,
  isDemo,
  periodDaysFrom,
} from "@/lib/integrations/demo";
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
import { makeT, type TFunc } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

const OVERLOAD_WIP = 5;

interface CollectedData {
  workItems: UnifiedWorkItem[];
  codeChanges: UnifiedCodeChange[];
  activity: ActivitySignal[];
  ciRuns: CiRun[];
  sources: ProviderSlug[];
  sourcesWithError: ProviderSlug[];
  /**
   * INT-02: fuentes cuyos datos son de demo (config.demo === "true"). Permite
   * al reporte distinguir data demo de data real.
   */
  demoSources: ProviderSlug[];
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
    demoSources: [],
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
        // INT-02: demo boundary centralizado. Si la integración está en modo
        // demo (config.demo === "true") devolvemos el dataset canónico
        // (demoDataFor) sin invocar nunca el adapter real — así ningún provider
        // pega a su API con un token "demo-token". Si demoDataFor no cubre el
        // slug, devuelve una estructura vacía segura (no llamada real).
        const data = isDemo(loaded.ctx.config)
          ? demoDataFor(entry.slug, periodDaysFrom({ since }))
          : await adapter.fetchData(loaded.ctx, { since });
        if (data.workItems) out.workItems.push(...data.workItems);
        if (data.codeChanges) out.codeChanges.push(...data.codeChanges);
        if (data.activity) out.activity.push(...data.activity);
        if (data.ciRuns) out.ciRuns.push(...data.ciRuns);
        out.sources.push(entry.slug);
        if (isDemo(loaded.ctx.config)) out.demoSources.push(entry.slug);
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

// ---------------------------------------------------------------------------
// Recorte al período seleccionado. Los adapters filtran por `since`
// (periodStart) pero traen todo hasta HOY; acá acotamos también por
// periodEnd para que un período histórico muestre solo su ventana.
// Fechas nulas/inválidas no excluyen el ítem (no podemos juzgarlas).
// ---------------------------------------------------------------------------

function ts(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function clampToPeriod(
  data: CollectedData,
  periodStart: Date,
  periodEnd: Date,
): CollectedData {
  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();
  const within = (t: number | null) =>
    t === null || (t >= startMs && t <= endMs);

  return {
    ...data,
    // Un work item pertenece al período si existía antes del fin del período
    // y, si está DONE, se resolvió dentro de la ventana (lo abierto cuenta
    // como trabajo en curso del período).
    workItems: data.workItems.filter((i) => {
      const created = ts(i.createdAt);
      if (created !== null && created > endMs) return false;
      if (i.bucket === "DONE")
        return within(ts(i.resolvedAt) ?? ts(i.updatedAt));
      return true;
    }),
    // PRs: creados antes del fin del período; merged/closed dentro de la
    // ventana para contar como actividad del período.
    codeChanges: data.codeChanges.filter((c) => {
      const created = ts(c.createdAt);
      if (created !== null && created > endMs) return false;
      if (c.state === "MERGED") return within(ts(c.mergedAt));
      if (c.state === "CLOSED") return within(ts(c.closedAt));
      return true;
    }),
    activity: data.activity.filter((a) => within(ts(a.createdAt))),
    ciRuns: data.ciRuns.filter((r) => within(ts(r.createdAt))),
  };
}

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
  t: TFunc,
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
    p.nextStep = nextStepFor(p, t);
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

function nextStepFor(p: PersonInsight, t: TFunc): string {
  return t(`gen.nextStep.${p.category}`);
}

function fmtDay(d: Date, locale: Locale): string {
  return d.toLocaleDateString(locale === "en" ? "en-US" : "es-AR", {
    day: "numeric",
    month: "numeric",
  });
}

/**
 * Etiqueta de un punto de tendencia: el RANGO del período (ej. "30/6–13/7").
 * Antes se usaba solo periodEnd, y como los presets siempre terminan "hoy",
 * todos los reportes generados el mismo día mostraban la misma fecha.
 */
function periodLabel(start: Date, end: Date, locale: Locale): string {
  return `${fmtDay(start, locale)}–${fmtDay(end, locale)}`;
}

/**
 * Evolución DENTRO del período del reporte: divide [periodStart, periodEnd] en
 * cortes de ~15 días (entre 2 y 8 según la duración) y computa por corte las
 * finalizadas (resolvedAt), PRs mergeados (mergedAt), velocity (SP resueltos)
 * y bloqueadas (ítems hoy bloqueados, ubicados por su última actualización).
 * Cada punto lleva la fecha de fin de su corte, así el eje SIEMPRE muestra
 * fechas distintas (a diferencia del histórico entre reportes).
 */
function buildTimeline(
  workItems: UnifiedWorkItem[],
  codeChanges: UnifiedCodeChange[],
  periodStart: Date,
  periodEnd: Date,
  locale: Locale,
): TrendPoint[] {
  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();
  if (!(endMs > startMs)) return [];

  const days = (endMs - startMs) / 864e5;
  // ~1 corte cada 15 días (ej.: 90 días → 6 fechas), acotado a [2, 8].
  const buckets = Math.min(8, Math.max(2, Math.round(days / 15)));
  const step = (endMs - startMs) / buckets;

  const at = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
  };
  const bucketOf = (t: number | null): number | null => {
    if (t === null || t < startMs || t > endMs) return null;
    return Math.min(buckets - 1, Math.floor((t - startMs) / step));
  };

  const points: TrendPoint[] = Array.from({ length: buckets }, (_, i) => ({
    label: fmtDay(new Date(startMs + (i + 1) * step), locale),
    done: 0,
    merged: 0,
    blocked: 0,
    velocityPoints: 0,
    health: null,
  }));

  for (const w of workItems) {
    if (w.bucket === "DONE") {
      const b = bucketOf(at(w.resolvedAt) ?? at(w.updatedAt));
      if (b !== null) {
        points[b].done++;
        points[b].velocityPoints += w.storyPoints ?? 0;
      }
    } else if (w.bucket === "BLOCKED") {
      const b = bucketOf(at(w.updatedAt));
      if (b !== null) points[b].blocked++;
    }
  }
  for (const c of codeChanges) {
    if (c.state === "MERGED") {
      const b = bucketOf(at(c.mergedAt));
      if (b !== null) points[b].merged++;
    }
  }

  return points;
}

async function buildTrend(
  projectId: string,
  current: TrendPoint,
  locale: Locale,
  currentPeriod?: { start: Date; end: Date },
): Promise<TrendPoint[]> {
  // Ordenado por PERÍODO (no por fecha de creación) para que el eje sea
  // cronológico. Traemos de más para poder dedupear períodos regenerados.
  const previous = await prisma.report.findMany({
    where: { projectId },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
    take: 15,
    select: {
      metrics: true,
      healthStatus: true,
      periodStart: true,
      periodEnd: true,
    },
  });

  // Un punto por período: si el mismo rango se regeneró, gana el más reciente.
  // El período del reporte ACTUAL se excluye (ya está como punto "Actual").
  const seen = new Set<string>();
  if (currentPeriod)
    seen.add(
      `${currentPeriod.start.toISOString()}|${currentPeriod.end.toISOString()}`,
    );
  const unique = previous
    .filter((r) => {
      const key = `${r.periodStart.toISOString()}|${r.periodEnd.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);

  const points: TrendPoint[] = unique
    .reverse()
    .map((r) => {
      const m = r.metrics as {
        workItems?: { done?: number; blocked?: number };
        codeChanges?: { merged?: number };
        capacity?: { velocityPoints?: number };
      } | null;
      return {
        label: periodLabel(
          new Date(r.periodStart),
          new Date(r.periodEnd),
          locale,
        ),
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
  locale: Locale = DEFAULT_LOCALE,
): Promise<ReportComputation> {
  const t = makeT(locale);
  const data = clampToPeriod(
    await collect(projectId, periodStart),
    periodStart,
    periodEnd,
  );
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

  const people = buildPeople(workItems, codeChanges, t);

  // ---- Risks ----
  const risks: Risk[] = [];
  const criticalStale = workItems.filter((i) => i.isCritical && i.isStale);
  if (criticalStale.length > 0)
    risks.push({
      level: "high",
      title: t("gen.risk.criticalStale.title", { count: criticalStale.length }),
      detail: criticalStale.slice(0, 5).map((i) => i.externalId).join(", "),
    });
  if (wi.blocked > 0)
    risks.push({
      level: wi.blocked >= 3 ? "high" : "medium",
      title: t("gen.risk.blocked.title", { count: wi.blocked }),
      detail: workItems
        .filter((i) => i.bucket === "BLOCKED")
        .slice(0, 5)
        .map((i) => i.externalId)
        .join(", "),
    });
  if (cc.old > 0)
    risks.push({
      level: cc.old >= 3 ? "high" : "medium",
      title: t("gen.risk.oldPrs.title", { count: cc.old }),
      detail: t("gen.risk.oldPrs.detail"),
    });
  if (cc.withoutReviewer > 0)
    risks.push({
      level: "medium",
      title: t("gen.risk.noReviewer.title", { count: cc.withoutReviewer }),
      detail: t("gen.risk.noReviewer.detail"),
    });
  if (cc.checksFailing > 0)
    risks.push({
      level: "medium",
      title: t("gen.risk.checksFailing.title", { count: cc.checksFailing }),
      detail: t("gen.risk.checksFailing.detail"),
    });
  const overloaded = people.filter((p) => p.category === "OVERLOADED");
  for (const p of overloaded.slice(0, 3))
    risks.push({
      level: "medium",
      title: t("gen.risk.overloaded.title", { name: p.name }),
      detail: t("gen.risk.overloaded.detail", { wip: p.wip }),
    });
  if (act.blockers > 0)
    risks.push({
      level: "medium",
      title: t("gen.risk.blockers.title", { count: act.blockers }),
      detail: t("gen.risk.blockers.detail"),
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
  const trend = await buildTrend(
    projectId,
    {
      label: t("gen.trend.current"),
      done: wi.done,
      merged: cc.merged,
      blocked: wi.blocked,
      velocityPoints: completedPoints,
      health: healthStatus,
    },
    locale,
    { start: periodStart, end: periodEnd },
  );

  // Evolución interna del período (lo que grafica la card "Tendencia").
  const timeline = buildTimeline(
    workItems,
    codeChanges,
    periodStart,
    periodEnd,
    locale,
  );

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
            ? t("gen.focus.blocked")
            : t("gen.focus.criticalStale"),
      })),
  };

  // ---- Recommendations ----
  const recommendations: string[] = [];
  if (cc.withoutReviewer > 0 || cc.old > 0)
    recommendations.push(t("gen.rec.reviewers"));
  if (wi.blocked > 0 || criticalStale.length > 0)
    recommendations.push(t("gen.rec.blocked"));
  if (cc.checksFailing > 0) recommendations.push(t("gen.rec.checks"));
  if (overloaded.length > 0)
    recommendations.push(
      t("gen.rec.balance", { names: overloaded.map((p) => p.name).join(", ") }),
    );
  if (people.some((p) => p.category === "FREE_CAPACITY"))
    recommendations.push(t("gen.rec.freeCapacity"));
  if (healthStatus === "HIGH_RISK") recommendations.push(t("gen.rec.highRisk"));
  if (recommendations.length === 0) recommendations.push(t("gen.rec.healthy"));

  // ---- Executive summary ----
  const healthLabel = t(`gen.health.${healthStatus}`);
  const summaryParts: string[] = [
    t("gen.summary.main", {
      completed: completedPoints,
      committed: committedPoints,
      pct: projectProgress.completionByPoints,
      done: wi.done,
      merged: cc.merged,
      health: healthLabel,
    }),
  ];
  const concerns: string[] = [];
  if (criticalStale.length > 0)
    concerns.push(t("gen.concern.criticalStale", { count: criticalStale.length }));
  if (wi.blocked > 0) concerns.push(t("gen.concern.blocked", { count: wi.blocked }));
  if (cc.old > 0) concerns.push(t("gen.concern.oldPrs", { count: cc.old }));
  if (cc.withoutReviewer > 0)
    concerns.push(t("gen.concern.noReviewer", { count: cc.withoutReviewer }));
  if (concerns.length > 0)
    summaryParts.push(t("gen.summary.concerns", { list: concerns.join(", ") }));
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
    timeline,
    people: people.slice(0, 25),
    sources: data.sources,
    // INT-02: fuentes en modo demo. TODO(demo-flag): agregar `demoSources` a
    // ReportMetrics en src/lib/reports/types.ts (fuera de este límite de
    // archivos) para tiparlo formalmente y consumirlo desde la UI/markdown.
    demoSources: data.demoSources,
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
    t,
    locale,
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
