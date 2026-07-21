import type { PersonInsight } from "./types";

export type PerfTier = "DESTACADA" | "CUMPLE" | "BAJO";

export const TIER_LABEL: Record<PerfTier, string> = {
  DESTACADA: "Destacada",
  CUMPLE: "Cumple (podría dar más)",
  BAJO: "Necesita apoyo",
};

export function tierVariant(
  t: PerfTier,
): "success" | "secondary" | "warning" {
  return t === "DESTACADA" ? "success" : t === "CUMPLE" ? "secondary" : "warning";
}

export interface PersonSprintPoint {
  label: string;
  tasksDone: number;
  throughput: number;
  completedPoints: number;
  blocked: number;
  stale: number;
  tier: PerfTier;
}

export interface PersonProfile {
  name: string;
  points: PersonSprintPoint[];
  latest: PersonInsight | null;
  tier: PerfTier;
  trend: "up" | "down" | "flat";
}

/**
 * Clasificación en 3 niveles a partir de las señales del período. Se usa como
 * punto de partida para conversar, no como veredicto.
 */
export function computeTier(p: PersonInsight | null): PerfTier {
  if (!p) return "CUMPLE";
  // Coherente con la categoría evidencia-based del reporte (evaluation-category):
  // no se marca BAJO por tener 1 bloqueada o 2 estancadas si hubo avance real.
  // "Datos insuficientes" es neutral acá; el gate de confianza (API) decide si se
  // muestra un veredicto.
  if (p.category === "INSUFFICIENT_DATA") return "CUMPLE";
  if (p.category === "RECOGNIZE") return "DESTACADA";
  if (p.category === "SUPPORT") return "BAJO";
  return "CUMPLE";
}

/**
 * `t` es opcional: si se pasa (desde un componente con i18n), las hipótesis
 * salen traducidas; si no, caen a español (para no romper matrix.ts / exports).
 */
export function contextHypotheses(
  p: PersonInsight | null,
  t?: (key: string) => string,
): string[] {
  const tr = (key: string, fallback: string) => (t ? t(key) : fallback);
  if (!p)
    return [tr("lib.profile.hyp.noData", "Sin datos suficientes en el período: validar en un 1:1.")];
  const out: string[] = [];
  if (p.tasksBlocked > 0)
    out.push(tr("lib.profile.hyp.blocked", "Dependencias o bloqueos no resueltos a tiempo."));
  if (p.tasksStale >= 1)
    out.push(tr("lib.profile.hyp.stale", "Tareas poco claras o mal priorizadas (sin movimiento)."));
  if (p.wip >= 5)
    out.push(tr("lib.profile.hyp.overload", "Sobrecarga o mala distribución de tareas."));
  if (p.wip > 0 && p.completedPoints === 0)
    out.push(tr("lib.profile.hyp.complexity", "Posible complejidad alta para su seniority o falta de acompañamiento."));
  if (p.throughput <= 1)
    out.push(tr("lib.profile.hyp.clarity", "Puede faltar claridad de objetivos o contexto de producto."));
  out.push(
    tr("lib.profile.hyp.validate", "Validar en 1:1 antes de concluir: claridad de tareas, acompañamiento y disponibilidad."),
  );
  return out;
}

/** Claves i18n de las preguntas 1:1 (traducir en el punto de render). */
export const COACHING_QUESTION_KEYS = [
  "lib.profile.q.blocking",
  "lib.profile.q.tasksClear",
  "lib.profile.q.moreSupport",
  "lib.profile.q.projectContext",
  "lib.profile.q.availability",
  "lib.profile.q.needToImprove",
  "lib.profile.q.commitment",
  "lib.profile.q.growthArea",
];

export const COACHING_QUESTIONS = [
  "¿Qué te está bloqueando?",
  "¿Sentís que las tareas están claras?",
  "¿Necesitás más acompañamiento técnico?",
  "¿Hay algo del contexto del proyecto que no estés entendiendo?",
  "¿Algo está afectando tu disponibilidad o motivación?",
  "¿Qué necesitás para poder mejorar?",
  "¿Qué compromiso concreto podés asumir para el próximo sprint?",
  "¿En qué área te gustaría crecer?",
];

export interface SustainedSignal {
  sprints: number;
  severity: "media" | "alta";
  escalate: boolean;
}

/**
 * Señal sostenida: cuenta cuántos sprints consecutivos (desde el más reciente)
 * la persona quedó en "Necesita apoyo". Solo alerta con 2 o más (criterio de no
 * concluir sin evidencia repetida).
 */
export function sustainedLow(tiersOldestFirst: PerfTier[]): SustainedSignal | null {
  let n = 0;
  for (let i = tiersOldestFirst.length - 1; i >= 0; i--) {
    if (tiersOldestFirst[i] === "BAJO") n++;
    else break;
  }
  if (n < 2) return null;
  return { sprints: n, severity: n >= 3 ? "alta" : "media", escalate: n >= 3 };
}

/**
 * `t` es opcional: si se pasa, los pasos salen traducidos; si no, caen a
 * español (para no romper matrix.ts / exports).
 */
export function coachingSteps(
  tier: PerfTier,
  t?: (key: string) => string,
): string[] {
  const tr = (key: string, fallback: string) => (t ? t(key) : fallback);
  if (tier === "DESTACADA")
    return [
      tr("lib.profile.steps.destacada.1", "Reconocer el aporte (1:1 o público)."),
      tr("lib.profile.steps.destacada.2", "Ofrecer mayor ownership o una tarea de más impacto."),
      tr("lib.profile.steps.destacada.3", "Proponer mentoría a compañeros; cuidar que no se sobrecargue."),
      tr("lib.profile.steps.destacada.4", "Diseñar un camino de crecimiento."),
    ];
  if (tier === "CUMPLE")
    return [
      tr("lib.profile.steps.cumple.1", "Dar feedback claro y un objetivo de crecimiento."),
      tr("lib.profile.steps.cumple.2", "Asignar una tarea desafiante pero alcanzable."),
      tr("lib.profile.steps.cumple.3", "Incentivar participación en refinamientos/retros y mayor visibilidad."),
      tr("lib.profile.steps.cumple.4", "Medir la evolución en los próximos 1-2 sprints."),
    ];
  return [
    tr("lib.profile.steps.bajo.1", "Tener un 1:1 privado para entender el contexto antes de juzgar."),
    tr("lib.profile.steps.bajo.2", "Aclarar expectativas del rol y dividir en tareas más chicas y medibles."),
    tr("lib.profile.steps.bajo.3", "Acompañamiento más frecuente y revisión intermedia."),
    tr("lib.profile.steps.bajo.4", "Documentar acuerdos y revisar la evolución en 1-2 sprints; escalar solo si no hay mejora."),
  ];
}
