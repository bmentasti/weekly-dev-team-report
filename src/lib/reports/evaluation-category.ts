// Categoría de desempeño y score individual — evidencia-based (auditoría §6, §7).
//
// PROBLEMA QUE RESUELVE
// ---------------------
// La clasificación anterior marcaba "Necesita apoyo" a CUALQUIERA con una tarea
// bloqueada o dos sin movimiento (`tasksBlocked > 0 || tasksStale >= 2`), aunque
// la persona hubiera completado su trabajo. Con el backlog inflando los
// contadores, prácticamente todo el equipo caía en "Necesita apoyo".
//
// REGLAS NUEVAS
// -------------
//  • "Necesita apoyo" (SUPPORT) SOLO con evidencia concreta: bloqueos
//    prolongados, tareas vencidas sin progreso, o cumplimiento muy bajo sobre
//    trabajo realmente asignado. Nunca por tener menos tareas, tareas más
//    complejas o depender de otro equipo.
//  • Sin datos suficientes → "Datos insuficientes" (INSUFFICIENT_DATA), nunca
//    "Necesita apoyo".
//  • El score parte del % de cumplimiento del compromiso (proporción), no de la
//    cantidad absoluta de tareas completadas.
//
// Módulo PURO y testeable (sin Prisma ni red).

import type { PersonCategory, PersonInsight } from "./types";

/** WIP a partir del cual se considera sobrecarga. */
export const OVERLOAD_WIP = 5;
/** Umbral de tareas estancadas para reforzar señales negativas. */
const STALE_MANY = 3;

export interface CategoryResult {
  category: PersonCategory;
  /** Evidencia específica y verificable (con números). */
  reason: string;
}

type Signals = Pick<
  PersonInsight,
  | "tasksDone"
  | "tasksInProgress"
  | "tasksBlocked"
  | "tasksStale"
  | "tasksTodo"
  | "committedTasks"
  | "addedTasks"
  | "prsOpen"
  | "prsMerged"
  | "committedPoints"
  | "throughput"
  | "wip"
>;

function assignedOf(p: Signals): number {
  return (
    p.tasksDone + p.tasksInProgress + p.tasksBlocked + (p.tasksTodo ?? 0)
  );
}

/** Base de compromiso para el % de cumplimiento: comprometidas si las hay, si no el total asignado. */
function commitmentBase(p: Signals): number {
  const committed = p.committedTasks ?? 0;
  return committed > 0 ? committed : assignedOf(p);
}

/** % de cumplimiento sobre el compromiso (null si no hay base sobre la cual medir). */
export function completionPct(p: Signals): number | null {
  const base = commitmentBase(p);
  if (base <= 0) return null;
  return Math.round((p.tasksDone / base) * 100);
}

function hasProgress(p: Signals): boolean {
  return p.tasksDone > 0 || p.tasksInProgress > 0 || p.prsMerged > 0;
}

/**
 * Score individual 0..100. Parte de la PROPORCIÓN de cumplimiento y suma
 * volumen de entrega y colaboración (acotados). Penaliza SOLO por evidencia
 * concreta (bloqueos prolongados, estancamiento), nunca por tener poca carga.
 */
export function scorePerson(p: Signals): number {
  const pct = completionPct(p);
  const base = pct ?? (hasProgress(p) ? 60 : 0);
  let s = base * 0.55; // hasta 55 por % de cumplimiento
  s += (Math.min(p.throughput, 6) / 6) * 25; // hasta 25 por volumen entregado
  s += (Math.min(p.prsMerged, 4) / 4) * 12; // hasta 12 por PRs mergeados
  s += p.tasksInProgress > 0 ? 8 : 0; // progreso real en curso
  // Penalizaciones acotadas y solo por evidencia:
  if (p.tasksBlocked > 0 && p.tasksStale > 0) s -= 10; // bloqueo prolongado
  s -= Math.min(p.tasksStale, 3) * 3; // hasta −9 por estancamiento
  return Math.max(0, Math.min(100, Math.round(s)));
}

/**
 * Clasifica a la persona con evidencia. Devuelve categoría + explicación.
 * Orden de prioridad pensado para no marcar SUPPORT cuando hay avance real.
 */
export function categorizePerson(p: Signals): CategoryResult {
  const assigned = assignedOf(p);
  const base = commitmentBase(p);
  const pct = completionPct(p);
  const progress = hasProgress(p);

  // 1) Sin nada atribuible → Datos insuficientes (NO "necesita apoyo").
  if (assigned === 0 && p.prsMerged === 0 && p.prsOpen === 0) {
    return {
      category: "INSUFFICIENT_DATA",
      reason:
        "Sin tareas ni actividad de código atribuibles en el período. Verificá el mapeo del responsable en Airtable.",
    };
  }

  // 2) Sobrecarga real de trabajo en paralelo.
  if (p.wip >= OVERLOAD_WIP) {
    return {
      category: "OVERLOADED",
      reason: `${p.wip} tareas en progreso en paralelo (umbral ${OVERLOAD_WIP}). Riesgo de dispersión.`,
    };
  }

  // 3) "Necesita apoyo" SOLO con evidencia concreta.
  if (p.tasksBlocked > 0 && p.tasksStale > 0) {
    return {
      category: "SUPPORT",
      reason: `${p.tasksBlocked} tarea(s) bloqueada(s) y sin movimiento hace >5 días: requiere desbloqueo.`,
    };
  }
  if (assigned >= 3 && p.tasksDone === 0 && !progress) {
    return {
      category: "SUPPORT",
      reason: `0 de ${base} tareas asignadas con avance; sin progreso registrado en el período.`,
    };
  }
  if (p.tasksStale >= STALE_MANY && p.tasksDone === 0) {
    return {
      category: "SUPPORT",
      reason: `${p.tasksStale} tareas estancadas (>5 días sin movimiento) y ninguna completada.`,
    };
  }

  // 4) Avance sólido: buen cumplimiento o volumen, sin bloqueos ni estancamiento.
  if (
    (pct !== null && pct >= 70 && p.tasksBlocked === 0) ||
    (p.throughput >= 3 && p.tasksBlocked === 0 && p.tasksStale === 0)
  ) {
    return {
      category: "RECOGNIZE",
      reason:
        pct !== null
          ? `${p.tasksDone} de ${base} comprometidas completadas (${pct}%), sin bloqueos.`
          : `${p.throughput} entregas en el período sin bloqueos ni estancamiento.`,
    };
  }

  // 5) Capacidad libre: poca carga asignada y disponible.
  if (assigned <= 1 && p.throughput <= 1 && (p.committedPoints ?? 0) <= 2) {
    return {
      category: "FREE_CAPACITY",
      reason: `Carga baja (${assigned} tarea(s) asignada(s)); capacidad disponible.`,
    };
  }

  // 6) En seguimiento (default): hay avance/pendientes pero sin evidencia de problema.
  const parts = [
    `${p.tasksDone}/${base} completadas`,
    `${p.tasksInProgress} en progreso`,
  ];
  if (p.tasksBlocked > 0) parts.push(`${p.tasksBlocked} bloqueada(s)`);
  if ((p.addedTasks ?? 0) > 0) parts.push(`${p.addedTasks} incorporada(s) en el sprint`);
  return {
    category: "ON_TRACK",
    reason: `${parts.join(", ")}. Dentro de lo esperado; en seguimiento.`,
  };
}
