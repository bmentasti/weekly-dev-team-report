import type { PersonInsight, ReportMetrics } from "./types";
import { computeTier } from "./people-profile";

export type Role = "TL" | "PO" | "DIR";
export type Direction = "good" | "bad" | "neutral";

interface MetricDef {
  key: string;
  label: string;
  get: (m: ReportMetrics) => number;
  lower: boolean; // menor es mejor
  roles: Role[];
}

const METRIC_DEFS: MetricDef[] = [
  { key: "velocity", label: "Velocity (pts)", get: (m) => m.capacity.velocityPoints, lower: false, roles: ["DIR", "PO"] },
  { key: "completion", label: "Avance por SP (%)", get: (m) => m.projectProgress.completionByPoints, lower: false, roles: ["DIR", "PO"] },
  { key: "done", label: "Tareas finalizadas", get: (m) => m.workItems.done, lower: false, roles: ["PO", "DIR"] },
  { key: "cycle", label: "Cycle time (d)", get: (m) => m.capacity.cycleTimeAvgDays ?? 0, lower: true, roles: ["TL", "DIR"] },
  { key: "blocked", label: "Bloqueadas", get: (m) => m.workItems.blocked, lower: true, roles: ["TL", "PO", "DIR"] },
  { key: "carry", label: "Carry-over", get: (m) => m.planning.carryOverItems, lower: true, roles: ["PO", "DIR"] },
  { key: "scope", label: "Scope creep (%)", get: (m) => m.quality?.scopeCreepPct ?? 0, lower: true, roles: ["PO", "DIR"] },
  { key: "bugs", label: "Bugs abiertos", get: (m) => m.quality?.bugsOpen ?? 0, lower: true, roles: ["TL", "PO"] },
  { key: "merged", label: "PR/MR mergeados", get: (m) => m.codeChanges.merged, lower: false, roles: ["TL"] },
  { key: "oldpr", label: "PR/MR >72h", get: (m) => m.codeChanges.old, lower: true, roles: ["TL"] },
  { key: "norev", label: "PR/MR sin reviewer / re-review", get: (m) => m.codeChanges.withoutReviewer, lower: true, roles: ["TL"] },
  { key: "ci", label: "CI tasa de fallo (%)", get: (m) => m.ci?.failureRatePct ?? 0, lower: true, roles: ["TL", "DIR"] },
];

export interface MetricComparison {
  key: string;
  label: string;
  a: number;
  b: number;
  deltaAbs: number;
  deltaPct: number | null;
  direction: Direction;
  interpretation: string;
  roles: Role[];
}

/** a = sprint más reciente, b = anterior. */
export function compareMetrics(a: ReportMetrics, b: ReportMetrics): MetricComparison[] {
  return METRIC_DEFS.map((d) => {
    const av = d.get(a);
    const bv = d.get(b);
    const deltaAbs = av - bv;
    const deltaPct = bv !== 0 ? Math.round((deltaAbs / Math.abs(bv)) * 100) : null;
    let direction: Direction = "neutral";
    if (deltaAbs !== 0) {
      const improved = d.lower ? deltaAbs < 0 : deltaAbs > 0;
      direction = improved ? "good" : "bad";
    }
    const interpretation =
      direction === "good" ? "Mejoró" : direction === "bad" ? "Empeoró" : "Sin cambio";
    return { key: d.key, label: d.label, a: av, b: bv, deltaAbs, deltaPct, direction, interpretation, roles: d.roles };
  });
}

export type TrendClass =
  | "MEJORA_CLARA"
  | "MEJORA_LEVE"
  | "SIN_CAMBIO"
  | "DETERIORO_LEVE"
  | "DETERIORO_CRITICO";

export const TREND_LABEL: Record<TrendClass, string> = {
  MEJORA_CLARA: "Mejora clara",
  MEJORA_LEVE: "Mejora leve",
  SIN_CAMBIO: "Sin cambio",
  DETERIORO_LEVE: "Deterioro leve",
  DETERIORO_CRITICO: "Deterioro crítico",
};

function classify(improvementPct: number): TrendClass {
  if (improvementPct >= 25) return "MEJORA_CLARA";
  if (improvementPct >= 8) return "MEJORA_LEVE";
  if (improvementPct > -8) return "SIN_CAMBIO";
  if (improvementPct > -25) return "DETERIORO_LEVE";
  return "DETERIORO_CRITICO";
}

export interface TrendItem {
  dimension: string;
  class: TrendClass;
}

function improvementPct(a: number, b: number, lower: boolean): number {
  if (b === 0) return a === 0 ? 0 : lower ? -100 : 100;
  const raw = ((a - b) / Math.abs(b)) * 100;
  return lower ? -raw : raw;
}

export function classifyTrends(a: ReportMetrics, b: ReportMetrics): TrendItem[] {
  const dims: { dimension: string; a: number; b: number; lower: boolean }[] = [
    { dimension: "Entrega", a: a.workItems.done, b: b.workItems.done, lower: false },
    { dimension: "Velocidad", a: a.capacity.velocityPoints, b: b.capacity.velocityPoints, lower: false },
    { dimension: "Previsibilidad (avance)", a: a.projectProgress.completionByPoints, b: b.projectProgress.completionByPoints, lower: false },
    { dimension: "Bloqueos", a: a.workItems.blocked, b: b.workItems.blocked, lower: true },
    { dimension: "Scope", a: a.quality?.scopeCreepPct ?? 0, b: b.quality?.scopeCreepPct ?? 0, lower: true },
    { dimension: "Calidad (bugs)", a: a.quality?.bugsOpen ?? 0, b: b.quality?.bugsOpen ?? 0, lower: true },
    { dimension: "PRs", a: a.codeChanges.old, b: b.codeChanges.old, lower: true },
    { dimension: "CI", a: a.ci?.failureRatePct ?? 0, b: b.ci?.failureRatePct ?? 0, lower: true },
    { dimension: "Cycle time", a: a.capacity.cycleTimeAvgDays ?? 0, b: b.capacity.cycleTimeAvgDays ?? 0, lower: true },
  ];
  return dims.map((d) => ({ dimension: d.dimension, class: classify(improvementPct(d.a, d.b, d.lower)) }));
}

export interface CompAlert {
  id: string;
  title: string;
  level: "media" | "alta";
  evidence: string;
  impact: string;
  action: string;
  role: Role;
}

export function comparisonAlerts(a: ReportMetrics, b: ReportMetrics): CompAlert[] {
  const out: CompAlert[] = [];
  if (a.planning.carryOverItems > b.planning.carryOverItems)
    out.push({ id: "carry-up", title: "Subió el carry-over", level: "media", evidence: `${b.planning.carryOverItems} → ${a.planning.carryOverItems}`, impact: "Menor previsibilidad; el próximo sprint arranca cargado.", action: "Cerrar antes de tomar nuevo y ajustar la capacidad comprometida.", role: "PO" });
  if (a.projectProgress.completionByPoints < b.projectProgress.completionByPoints - 5)
    out.push({ id: "completion-down", title: "Bajó el avance por SP", level: "alta", evidence: `${b.projectProgress.completionByPoints}% → ${a.projectProgress.completionByPoints}%`, impact: "Riesgo de no cumplir compromisos.", action: "Revisar alcance y estimaciones antes del próximo planning.", role: "DIR" });
  if (b.capacity.velocityPoints > 0 && a.capacity.velocityPoints < b.capacity.velocityPoints * 0.8)
    out.push({ id: "velocity-down", title: "Cayó la velocity", level: "alta", evidence: `${b.capacity.velocityPoints} → ${a.capacity.velocityPoints} pts`, impact: "Menos previsibilidad; posible bloqueo o sobrecarga.", action: "Investigar causa (bloqueos, ausencias, complejidad).", role: "DIR" });
  if ((a.capacity.cycleTimeAvgDays ?? 0) > (b.capacity.cycleTimeAvgDays ?? 0) + 0.5)
    out.push({ id: "cycle-up", title: "Subió el cycle time", level: "media", evidence: `${b.capacity.cycleTimeAvgDays ?? 0}d → ${a.capacity.cycleTimeAvgDays ?? 0}d`, impact: "Las tareas tardan más en cerrarse.", action: "Revisar tareas grandes sin dividir y cuellos de review.", role: "TL" });
  if (a.codeChanges.old > b.codeChanges.old)
    out.push({ id: "oldpr-up", title: "Más PR/MR viejos", level: "media", evidence: `${b.codeChanges.old} → ${a.codeChanges.old}`, impact: "Se acumula trabajo sin integrar.", action: "Acordar SLA de review y priorizar merges.", role: "TL" });
  if ((a.quality?.bugsOpen ?? 0) > (b.quality?.bugsOpen ?? 0))
    out.push({ id: "bugs-up", title: "Más bugs abiertos", level: "media", evidence: `${b.quality?.bugsOpen ?? 0} → ${a.quality?.bugsOpen ?? 0}`, impact: "Calidad en baja y más rework.", action: "Reforzar testing y priorizar bugs.", role: "TL" });
  if ((a.quality?.scopeCreepPct ?? 0) > (b.quality?.scopeCreepPct ?? 0) + 5)
    out.push({ id: "scope-up", title: "Más scope creep", level: "media", evidence: `${b.quality?.scopeCreepPct ?? 0}% → ${a.quality?.scopeCreepPct ?? 0}%`, impact: "Cambios de alcance restan foco.", action: "Congelar alcance; canalizar lo nuevo al backlog.", role: "PO" });
  return out;
}

// ---- Evolución por persona (5 categorías) ----
export type PersonCat = "DESTACADA" | "ESTABLE" | "CUMPLE_MAS" | "OBSERVACION" | "RIESGO";
export const PERSON_CAT_LABEL: Record<PersonCat, string> = {
  DESTACADA: "Destacada",
  ESTABLE: "Estable",
  CUMPLE_MAS: "Cumple (podría dar más)",
  OBSERVACION: "En observación",
  RIESGO: "En riesgo",
};

export interface PersonEvolution {
  name: string;
  s1: PersonInsight | null;
  s2: PersonInsight | null;
  movement: "up" | "down" | "flat";
  category: PersonCat;
}

function classifyEvolution(s1: PersonInsight | null, s2: PersonInsight | null): PersonCat {
  const t2 = computeTier(s2);
  const t1 = computeTier(s1);
  if (t2 === "DESTACADA") return "DESTACADA";
  if (t2 === "BAJO") return t1 === "BAJO" ? "RIESGO" : "OBSERVACION";
  // CUMPLE
  if ((s2?.throughput ?? 0) >= 3) return "ESTABLE";
  return "CUMPLE_MAS";
}

export function evolvePeople(a: ReportMetrics, b: ReportMetrics): PersonEvolution[] {
  const names = new Set<string>();
  a.people.forEach((p) => names.add(p.name));
  b.people.forEach((p) => names.add(p.name));
  const out: PersonEvolution[] = [];
  for (const name of names) {
    const s2 = a.people.find((p) => p.name === name) ?? null;
    const s1 = b.people.find((p) => p.name === name) ?? null;
    const d = (s2?.throughput ?? 0) - (s1?.throughput ?? 0);
    out.push({
      name,
      s1,
      s2,
      movement: d > 0 ? "up" : d < 0 ? "down" : "flat",
      category: classifyEvolution(s1, s2),
    });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}

// ---- Recomendación de planificación ----
export interface PlanningRec {
  suggestedCapacity: number;
  scope: string;
  margin: string;
  notes: string[];
}

export function planningRecommendation(a: ReportMetrics, b: ReportMetrics): PlanningRec {
  const cap = Math.round((a.capacity.velocityPoints + b.capacity.velocityPoints) / 2);
  const declining = a.capacity.velocityPoints < b.capacity.velocityPoints;
  const notes: string[] = [];
  if (a.planning.carryOverItems > 0)
    notes.push(`Reservar espacio para ${a.planning.carryOverItems} tarea(s) de carry-over.`);
  if ((a.quality?.bugsOpen ?? 0) > 0)
    notes.push("Dejar margen para bugs abiertos y deuda técnica.");
  if ((a.quality?.scopeCreepPct ?? 0) >= 25)
    notes.push("Congelar alcance: hubo mucho scope creep.");
  if (a.workItems.blocked > 0)
    notes.push("Resolver dependencias/bloqueos antes del planning.");
  return {
    suggestedCapacity: cap,
    scope: declining
      ? `Comprometer conservador (~${Math.max(cap - 3, 0)} pts) hasta estabilizar.`
      : `Comprometer ~${cap} pts en línea con la velocity reciente.`,
    margin: (a.quality?.bugsOpen ?? 0) > 2 ? "20% para bugs/deuda" : "10-15% para bugs/deuda",
    notes,
  };
}
