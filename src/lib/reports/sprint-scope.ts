// Pertenencia al sprint y deduplicación de tareas (auditoría §"Delimitación del
// período" y §"Auditoría de la integración con Airtable").
//
// PROBLEMA QUE RESUELVE
// ---------------------
// El reporte contabilizaba 135+ tareas porque:
//  1) el filtro server-side traía todo lo creado O modificado desde el inicio
//     (LAST_MODIFIED_TIME cambia por cualquier edición, comentario o rollup), y
//  2) el recorte por período conservaba TODA tarea abierta creada antes del fin
//     del período (`return true`), sin exigir que perteneciera al sprint.
// Resultado: backlog completo + tareas de otros sprints + históricas.
//
// REGLA DE PERTENENCIA (sprint por rango de fechas de dos semanas)
// ---------------------------------------------------------------
// Como no hay un campo Sprint explícito, una tarea pertenece a la ventana
// [inicio, fin] SOLO si tiene vida real dentro de ella:
//   • Completada:   resolvedAt (o, si falta, updatedAt) dentro de la ventana.
//   • No completada: creada, iniciada o actualizada dentro de la ventana.
// Una tarea abierta creada antes del inicio y NO tocada durante la ventana es
// backlog/otro sprint y NO se cuenta. Una tarea creada después del fin es
// trabajo futuro y NO se cuenta.
//
// Este módulo es PURO (sin Prisma ni red) para poder testear las 14 validaciones
// obligatorias de forma aislada y determinista.

import type { UnifiedWorkItem } from "@/lib/integrations/types";

export function tsOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function inWindow(t: number | null, start: number, end: number): boolean {
  return t !== null && t >= start && t <= end;
}

/**
 * Identificador ESTABLE y único de una tarea para deduplicar. Prioriza el record
 * id opaco de Airtable (`recordId`), que nunca cambia y es único en la base.
 * Cae al `externalId` (campo "ID" del usuario), luego a la URL y por último al
 * título. NUNCA se usa solo el nombre visible como clave primaria.
 */
export function workItemStableKey(i: UnifiedWorkItem): string {
  const id =
    (i.recordId && i.recordId.trim()) ||
    (i.externalId && i.externalId.trim()) ||
    (i.url && i.url.trim()) ||
    (i.title && i.title.trim()) ||
    "";
  return `${i.source}::${id}`;
}

function laterIso(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const ta = tsOf(a);
  const tb = tsOf(b);
  if (ta === null) return b ?? null;
  if (tb === null) return a ?? null;
  return ta >= tb ? a! : b!;
}

/**
 * Une dos filas que representan la MISMA tarea (mismo stable key). Conserva el
 * estado/fechas de la fila más recientemente modificada y UNE los responsables
 * (una tarea con varios participantes no debe duplicar el registro; validaciones
 * §2 y §3). Idempotente: re-sincronizar no acumula (validación §14).
 */
export function mergeWorkItems(
  a: UnifiedWorkItem,
  b: UnifiedWorkItem,
): UnifiedWorkItem {
  const aNewer = (tsOf(a.updatedAt) ?? 0) >= (tsOf(b.updatedAt) ?? 0);
  const base = aNewer ? a : b;
  const assignees = Array.from(
    new Set(
      [
        ...(a.assignees ?? (a.assignee ? [a.assignee] : [])),
        ...(b.assignees ?? (b.assignee ? [b.assignee] : [])),
      ]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
  return {
    ...base,
    assignee: assignees[0] ?? base.assignee ?? null,
    assignees: assignees.length > 1 ? assignees : undefined,
    createdAt: laterIso(a.createdAt, b.createdAt) === a.createdAt ? a.createdAt : b.createdAt,
    updatedAt: laterIso(a.updatedAt, b.updatedAt),
    resolvedAt: laterIso(a.resolvedAt, b.resolvedAt),
  };
}

/**
 * Deduplica una lista de tareas por identificador estable. Una tarea con varias
 * relaciones, participantes o traída por dos consultas cuenta UNA sola vez.
 */
export function dedupeWorkItems(items: UnifiedWorkItem[]): UnifiedWorkItem[] {
  const map = new Map<string, UnifiedWorkItem>();
  for (const it of items) {
    const key = workItemStableKey(it);
    const prev = map.get(key);
    map.set(key, prev ? mergeWorkItems(prev, it) : { ...it });
  }
  return Array.from(map.values());
}

/**
 * ¿La tarea no tiene NINGUNA fecha utilizable? En ese caso no se puede ubicar en
 * el período de forma confiable: se reporta aparte como "sin información
 * suficiente" en vez de inflar (o desinflar) el sprint por suposición.
 */
export function hasInsufficientDates(i: UnifiedWorkItem): boolean {
  return (
    tsOf(i.createdAt) === null &&
    tsOf(i.updatedAt) === null &&
    tsOf(i.resolvedAt) === null &&
    tsOf(i.startedAt) === null
  );
}

/**
 * Regla de pertenencia al sprint por rango de fechas. Ver cabecera del módulo.
 * Fechas nulas se ignoran (no cuentan como evidencia); si NO hay ninguna fecha,
 * `hasInsufficientDates` la clasifica aparte y este predicado devuelve false.
 */
export function belongsToPeriod(
  i: UnifiedWorkItem,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  const start = periodStart.getTime();
  const end = periodEnd.getTime();

  const created = tsOf(i.createdAt);
  const updated = tsOf(i.updatedAt);
  const resolved = tsOf(i.resolvedAt);
  const started = tsOf(i.startedAt);

  // Trabajo futuro: creado después del fin del período.
  if (created !== null && created > end) return false;

  if (i.bucket === "DONE") {
    // Completada este sprint: se resolvió dentro de la ventana.
    const doneAt = resolved ?? updated;
    return inWindow(doneAt, start, end);
  }

  // No completada: debe mostrar vida real dentro de la ventana.
  if (inWindow(created, start, end)) return true; // incorporada durante el sprint
  if (inWindow(started, start, end)) return true; // iniciada en el sprint
  if (inWindow(updated, start, end)) return true; // trabajada en el sprint

  // Abierta, creada antes de la ventana y sin actividad en ella → backlog / otro
  // sprint: NO pertenece.
  return false;
}

/**
 * Sub-clasificación de una tarea del sprint respecto del compromiso original,
 * para no distorsionar el % de cumplimiento (auditoría §"Clasificación").
 */
export type SprintScopeTag =
  | "committed" // existía al inicio del sprint (comprometida)
  | "added"; // incorporada durante el sprint (scope creep, no penaliza el compromiso)

export function scopeTagOf(i: UnifiedWorkItem, periodStart: Date): SprintScopeTag {
  const created = tsOf(i.createdAt);
  return created !== null && created > periodStart.getTime() ? "added" : "committed";
}

export interface ScopedWorkItems {
  /** Tareas únicas que pertenecen al sprint. */
  items: UnifiedWorkItem[];
  /** Descartadas por no pertenecer (backlog / otros sprints / futuras). */
  excludedOutOfPeriod: number;
  /** Descartadas por no tener fechas para ubicarlas (sin información). */
  insufficientData: number;
  /** Duplicados colapsados durante la deduplicación. */
  duplicatesCollapsed: number;
}

/**
 * Pipeline completo de alcance del sprint: deduplica y aplica la regla de
 * pertenencia, devolviendo además el conteo de lo descartado para trazabilidad.
 */
export function scopeToSprint(
  raw: UnifiedWorkItem[],
  periodStart: Date,
  periodEnd: Date,
): ScopedWorkItems {
  const deduped = dedupeWorkItems(raw);
  const duplicatesCollapsed = raw.length - deduped.length;

  let excludedOutOfPeriod = 0;
  let insufficientData = 0;
  const items: UnifiedWorkItem[] = [];

  for (const it of deduped) {
    if (hasInsufficientDates(it)) {
      insufficientData++;
      continue;
    }
    if (belongsToPeriod(it, periodStart, periodEnd)) {
      items.push(it);
    } else {
      excludedOutOfPeriod++;
    }
  }

  return { items, excludedOutOfPeriod, insufficientData, duplicatesCollapsed };
}
