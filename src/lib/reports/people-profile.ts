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
  if (
    p.throughput >= 4 &&
    p.tasksBlocked === 0 &&
    p.tasksStale === 0 &&
    p.category !== "SUPPORT"
  )
    return "DESTACADA";
  if (
    p.category === "SUPPORT" ||
    p.tasksBlocked > 0 ||
    p.tasksStale >= 2 ||
    (p.wip > 0 && p.completedPoints === 0)
  )
    return "BAJO";
  return "CUMPLE";
}

export function contextHypotheses(p: PersonInsight | null): string[] {
  if (!p) return ["Sin datos suficientes en el período: validar en un 1:1."];
  const out: string[] = [];
  if (p.tasksBlocked > 0)
    out.push("Dependencias o bloqueos no resueltos a tiempo.");
  if (p.tasksStale >= 1)
    out.push("Tareas poco claras o mal priorizadas (sin movimiento).");
  if (p.wip >= 5) out.push("Sobrecarga o mala distribución de tareas.");
  if (p.wip > 0 && p.completedPoints === 0)
    out.push("Posible complejidad alta para su seniority o falta de acompañamiento.");
  if (p.throughput <= 1)
    out.push("Puede faltar claridad de objetivos o contexto de producto.");
  out.push(
    "Validar en 1:1 antes de concluir: claridad de tareas, acompañamiento y disponibilidad.",
  );
  return out;
}

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

export function coachingSteps(tier: PerfTier): string[] {
  if (tier === "DESTACADA")
    return [
      "Reconocer el aporte (1:1 o público).",
      "Ofrecer mayor ownership o una tarea de más impacto.",
      "Proponer mentoría a compañeros; cuidar que no se sobrecargue.",
      "Diseñar un camino de crecimiento.",
    ];
  if (tier === "CUMPLE")
    return [
      "Dar feedback claro y un objetivo de crecimiento.",
      "Asignar una tarea desafiante pero alcanzable.",
      "Incentivar participación en refinamientos/retros y mayor visibilidad.",
      "Medir la evolución en los próximos 1-2 sprints.",
    ];
  return [
    "Tener un 1:1 privado para entender el contexto antes de juzgar.",
    "Aclarar expectativas del rol y dividir en tareas más chicas y medibles.",
    "Acompañamiento más frecuente y revisión intermedia.",
    "Documentar acuerdos y revisar la evolución en 1-2 sprints; escalar solo si no hay mejora.",
  ];
}
