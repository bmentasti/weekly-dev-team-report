// Historial de asignaciones de un issue de Jira (auditoría §5).
//
// Regla: NO atribuir todo el historial de una tarea al responsable ACTUAL.
// Para una tarea completada, se atribuye a quien era el responsable al momento
// de resolverse (según el changelog), no a quien figure asignado ahora.
// Módulo PURO y testeable (no depende del cliente Jira).

export interface AssigneeChange {
  /** Epoch ms del cambio. */
  atMs: number;
  /** displayName previo (antes del cambio) o null. */
  fromString: string | null;
  /** displayName nuevo (después del cambio) o null. */
  toString: string | null;
}

interface RawChangelog {
  histories?: {
    created?: string;
    items?: { field?: string; fromString?: string | null; toString?: string | null }[];
  }[];
}

/** Extrae los cambios de asignación del changelog, ordenados por fecha desc. */
export function assigneeChanges(changelog: RawChangelog | undefined): AssigneeChange[] {
  const out: AssigneeChange[] = [];
  for (const h of changelog?.histories ?? []) {
    const at = h.created ? new Date(h.created).getTime() : NaN;
    if (Number.isNaN(at)) continue;
    for (const it of h.items ?? []) {
      if ((it.field ?? "").toLowerCase() === "assignee") {
        out.push({
          atMs: at,
          fromString: it.fromString ?? null,
          toString: it.toString ?? null,
        });
      }
    }
  }
  return out.sort((a, b) => b.atMs - a.atMs); // desc
}

/**
 * Responsable en el momento `atMs`. Parte del responsable ACTUAL y deshace los
 * cambios de asignación posteriores a `atMs` (el `fromString` de cada cambio es
 * el valor previo). Si `atMs` es null, devuelve el actual.
 */
export function assigneeAt(
  currentAssignee: string | null,
  changesDesc: AssigneeChange[],
  atMs: number | null,
): string | null {
  if (atMs === null) return currentAssignee;
  let who = currentAssignee;
  for (const c of changesDesc) {
    if (c.atMs > atMs) who = c.fromString;
    else break; // cambios ya sorteados desc: el resto es anterior a atMs
  }
  return who;
}

/** ¿Hubo al menos una reasignación desde `sinceMs` (o alguna vez si null)? */
export function wasReassigned(changesDesc: AssigneeChange[], sinceMs: number | null): boolean {
  if (sinceMs === null) return changesDesc.length > 0;
  return changesDesc.some((c) => c.atMs >= sinceMs);
}
