import type { PersonInsight } from "./types";
import { formatDate } from "@/lib/utils";
import {
  computeTier,
  contextHypotheses,
  coachingSteps,
  sustainedLow,
  TIER_LABEL,
  type PerfTier,
} from "./people-profile";

export const MATRIX_COLUMNS = [
  "Persona",
  "Rol",
  "Seniority",
  "Categoría",
  "Entrega",
  "Comunicación",
  "Participación",
  "Autonomía",
  "Ownership",
  "Feedback",
  "Evolución",
  "Riesgo",
  "Evidencia",
  "Causas",
  "Acción",
  "Objetivo próximo sprint",
  "Indicador de mejora",
  "Revisión",
] as const;

export type MatrixRow = Record<(typeof MATRIX_COLUMNS)[number], string>;

export interface PersonInput {
  name: string;
  latest: PersonInsight | null;
  tiers: PerfTier[]; // oldest first
  trend: "up" | "down" | "flat";
  context: Record<string, string> | null;
}

const LEVEL_LABEL: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};
const LEVEL_NUM: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function ceremonyAvg(ctx: Record<string, string> | null): string {
  if (!ctx) return "—";
  const vals = ["daily", "refinement", "retro", "demo"]
    .map((k) => LEVEL_NUM[ctx[k] ?? ""])
    .filter((n) => typeof n === "number");
  if (vals.length === 0) return "—";
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return avg >= 2.5 ? "Alta" : avg >= 1.5 ? "Media" : "Baja";
}

const OBJECTIVE: Record<PerfTier, string> = {
  DESTACADA: "Tomar una tarea de mayor impacto o mentorear a un/a compañero/a.",
  CUMPLE: "Completar una tarea desafiante y participar en un refinamiento.",
  BAJO: "Cerrar lo comprometido sin bloqueos arrastrados.",
};
const INDICATOR: Record<PerfTier, string> = {
  DESTACADA: "Entrega con calidad + 1 iniciativa concreta.",
  CUMPLE: "Tarea desafiante entregada + mayor participación.",
  BAJO: "0 tareas arrastradas y bloqueos comunicados a tiempo.",
};
const AUTONOMY: Record<PerfTier, string> = {
  DESTACADA: "Alta",
  CUMPLE: "Media",
  BAJO: "En desarrollo",
};

export function buildMatrixRow(p: PersonInput): MatrixRow {
  const tier = computeTier(p.latest);
  const s = sustainedLow(p.tiers);
  const ctx = p.context;
  const l = p.latest;
  const evidence: string[] = [];
  if (l) {
    if (l.tasksBlocked > 0) evidence.push(`${l.tasksBlocked} bloqueada(s)`);
    if (l.tasksStale > 0) evidence.push(`${l.tasksStale} sin mov.`);
    evidence.push(`${l.tasksDone} finalizadas`, `${l.prsMerged} PR merg.`);
  }
  return {
    Persona: p.name,
    Rol: ctx?.role || "—",
    Seniority: ctx?.seniority || "—",
    Categoría: TIER_LABEL[tier],
    Entrega: l ? `${l.tasksDone} tareas / ${l.completedPoints} SP` : "—",
    Comunicación: ctx?.daily ? LEVEL_LABEL[ctx.daily] : "—",
    Participación: ceremonyAvg(ctx),
    Autonomía: AUTONOMY[tier],
    Ownership: ctx?.ownership ? LEVEL_LABEL[ctx.ownership] : "—",
    Feedback: ctx?.feedback || "—",
    Evolución: p.trend === "up" ? "Mejora" : p.trend === "down" ? "Baja" : "Estable",
    Riesgo: s ? (s.severity === "alta" ? "Alto" : "Medio") : "Bajo",
    Evidencia: evidence.join(", ") || "—",
    Causas: contextHypotheses(l).slice(0, 2).join("; "),
    Acción: coachingSteps(tier)[0],
    "Objetivo próximo sprint": OBJECTIVE[tier],
    "Indicador de mejora": INDICATOR[tier],
    Revisión: formatDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
  };
}

function esc(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function matrixToCsv(rows: MatrixRow[]): string {
  const header = MATRIX_COLUMNS.join(",");
  const lines = rows.map((r) =>
    MATRIX_COLUMNS.map((c) => esc(r[c] ?? "")).join(","),
  );
  return "﻿" + [header, ...lines].join("\n");
}
