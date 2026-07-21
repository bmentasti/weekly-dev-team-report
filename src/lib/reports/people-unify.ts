// Unificación de personas de un reporte YA GUARDADO, aplicada en lectura.
//
// Los reportes generados antes de tener la capa de identidad (o antes de crear
// un alias) guardan `metrics.people` con identificadores crudos (p. ej. record
// ids de Airtable) y a veces la misma persona repetida por venir de apps
// distintas. Esta función re-agrupa esas filas por identidad canónica y recalcula
// los derivados, con la MISMA lógica que la generación, sin necesidad de
// regenerar el reporte.

import { prisma } from "@/lib/prisma";
import { makeT } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { makeResolver, resolvePerson, type Resolver } from "./identity";
import { autoMergeGroups } from "./identity-suggest";
import { getIdentityConfig } from "./identity-store";
import { filterActivePeople, maxIso } from "./activity";
import { categorizePerson, scorePerson } from "./evaluation-category";
import type {
  PersonCategory,
  PersonInsight,
  PersonTimelinePoint,
  ReportMetrics,
} from "./types";

/**
 * Suma dos timelines por índice (todos los del mismo reporte comparten cortes,
 * así que alinean por posición). Devuelve el que exista si el otro falta.
 */
function mergeTimeline(
  a: PersonTimelinePoint[] | undefined,
  b: PersonTimelinePoint[] | undefined,
): PersonTimelinePoint[] | undefined {
  if (!a) return b ? b.map((p) => ({ ...p })) : undefined;
  if (!b) return a.map((p) => ({ ...p }));
  const n = Math.max(a.length, b.length);
  const out: PersonTimelinePoint[] = [];
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    const base = x ?? y!;
    out.push({
      label: base.label,
      done: (x?.done ?? 0) + (y?.done ?? 0),
      merged: (x?.merged ?? 0) + (y?.merged ?? 0),
      blocked: (x?.blocked ?? 0) + (y?.blocked ?? 0),
      velocityPoints: (x?.velocityPoints ?? 0) + (y?.velocityPoints ?? 0),
    });
  }
  return out;
}

/**
 * Re-agrupa `people` por identidad canónica sumando contadores y recalculando
 * wip/throughput/score/categoría/próximo paso y el ranking.
 */
export function unifyPeople(
  people: PersonInsight[],
  resolve: Resolver,
  nextStep: (category: PersonCategory) => string,
): PersonInsight[] {
  // Pasada 1: identidad canónica (alias) por persona.
  const resolved = people.map((p) => ({ p, r: resolvePerson(resolve, p) }));

  // Auto-merge de alta confianza sobre las identidades distintas (une, p. ej.,
  // "gonzaloavalos29" de GitHub con "Gonzalo Ávalos" de Airtable sin fusión manual).
  const distinct = new Map<string, string>();
  for (const { r } of resolved) if (r.id && !distinct.has(r.id)) distinct.set(r.id, r.name);
  const { groupId, displayName } = autoMergeGroups(
    Array.from(distinct, ([id, name]) => ({ id, name })),
  );
  const finalKey = (id: string) => groupId.get(id) ?? id;
  const finalName = (id: string, fallback: string) => displayName.get(id) ?? fallback;

  const map = new Map<string, PersonInsight>();
  const cycles = new Map<string, number[]>();

  for (const { p, r } of resolved) {
    const rid = r.id || p.name;
    const key = finalKey(rid);
    const name = finalName(rid, r.name || p.name);
    let e = map.get(key);
    if (!e) {
      e = {
        id: key,
        name: name || p.name,
        tasksDone: 0,
        tasksInProgress: 0,
        tasksBlocked: 0,
        tasksStale: 0,
        tasksTodo: 0,
        committedTasks: 0,
        addedTasks: 0,
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
        lastActivityAt: null,
      };
      map.set(key, e);
      cycles.set(key, []);
    }
    // La última actividad de la identidad unificada es la más reciente entre
    // las filas que se fusionan (cross-app / cross-alias).
    e.lastActivityAt = maxIso(e.lastActivityAt, p.lastActivityAt);
    e.timeline = mergeTimeline(e.timeline, p.timeline);
    e.tasksDone += p.tasksDone;
    e.tasksInProgress += p.tasksInProgress;
    e.tasksBlocked += p.tasksBlocked;
    e.tasksStale += p.tasksStale;
    e.tasksTodo = (e.tasksTodo ?? 0) + (p.tasksTodo ?? 0);
    e.committedTasks = (e.committedTasks ?? 0) + (p.committedTasks ?? 0);
    e.addedTasks = (e.addedTasks ?? 0) + (p.addedTasks ?? 0);
    e.prsOpen += p.prsOpen;
    e.prsMerged += p.prsMerged;
    e.committedPoints += p.committedPoints;
    e.completedPoints += p.completedPoints;
    if (typeof p.cycleTimeAvgDays === "number") cycles.get(key)!.push(p.cycleTimeAvgDays);
  }

  const out = Array.from(map.values());
  for (const e of out) {
    e.wip = e.tasksInProgress;
    e.throughput = e.tasksDone + e.prsMerged;
    const cs = cycles.get(e.id!) ?? [];
    e.cycleTimeAvgDays = cs.length
      ? Math.round((cs.reduce((a, b) => a + b, 0) / cs.length) * 10) / 10
      : null;
    e.score = scorePerson(e);
    const cat = categorizePerson(e);
    e.category = cat.category;
    e.categoryReason = cat.reason;
    e.nextStep = nextStep(e.category);
  }
  out.sort((a, b) => b.score - a.score);
  out.forEach((p, i) => (p.rank = i + 1));
  return out;
}

/**
 * Aplica la unificación de identidad a `metrics.people` de un reporte guardado.
 * Devuelve un `metrics` nuevo (no muta). Si no hay proyecto o gente, lo deja igual.
 * Resiliente: ante cualquier error devuelve el metrics original.
 */
export async function unifyReportMetricsPeople(
  projectId: string | null,
  metrics: ReportMetrics | null,
  locale: Locale = DEFAULT_LOCALE,
): Promise<ReportMetrics | null> {
  if (!projectId || !metrics || !Array.isArray(metrics.people) || metrics.people.length === 0)
    return metrics;
  try {
    const resolve = makeResolver(await getIdentityConfig(projectId));
    const t = makeT(locale);
    const unified = unifyPeople(metrics.people, resolve, (c) => t(`gen.nextStep.${c}`));
    // Excluye a quienes llevan > REPORT_INACTIVE_DAYS sin actividad (medido
    // contra hoy). Reportes viejos sin `lastActivityAt` no se ven afectados.
    const people = filterActivePeople(unified);
    return { ...metrics, people };
  } catch (err) {
    console.error("[identity] unifyReportMetricsPeople falló, dejo metrics original:", err);
    return metrics;
  }
}

/**
 * Devuelve una copia del reporte con `metrics.people` unificado por identidad.
 * Pensado para las rutas de lectura/export (report detail, PDF, CSV).
 */
export async function withUnifiedReportPeople<
  T extends { projectId: string | null; metrics: unknown },
>(report: T, locale: Locale = DEFAULT_LOCALE): Promise<T> {
  const metrics = await unifyReportMetricsPeople(
    report.projectId,
    report.metrics as ReportMetrics | null,
    locale,
  );
  if (metrics === report.metrics) return report;
  return { ...report, metrics: metrics as T["metrics"] };
}
