// Estadísticas de asociación de un sync: cuántos participantes quedaron
// vinculados a una identidad y cuánta actividad quedó SIN persona asociada.
//
// El spec pide distinguir "actividad encontrada sin identidad asociada" del
// resto. Este módulo es PURO: recibe la data normalizada del provider y un
// resolver de identidad, y devuelve contadores para exponer en la salud del sync.

import type { ProviderData } from "@/lib/integrations/types";
import type { Resolver } from "./identity";

export interface AssociationStats {
  /** Identidades canónicas distintas detectadas (participantes vinculados). */
  participantsLinked: number;
  /** Registros con actividad pero SIN persona atribuible (author/assignee vacío). */
  unassociatedRecords: number;
}

function handlesOfWorkItem(w: {
  source: string;
  assignee: string | null;
  assignees?: string[];
}): string[] {
  if (w.assignees && w.assignees.length) return w.assignees.filter(Boolean);
  return w.assignee ? [w.assignee] : [];
}

/**
 * Computa participantes vinculados y registros sin asociación a partir de la
 * data del provider. Un registro cuenta como "sin asociación" cuando no tiene
 * ninguna persona atribuible (author/assignee vacío).
 */
export function computeAssociationStats(
  data: ProviderData,
  resolve: Resolver,
): AssociationStats {
  const linked = new Set<string>();
  let unassociated = 0;

  for (const w of data.workItems ?? []) {
    const handles = handlesOfWorkItem(w);
    if (handles.length === 0) {
      unassociated++;
      continue;
    }
    for (const h of handles) {
      const r = resolve({ source: w.source, handle: h });
      if (r.id) linked.add(r.id);
    }
  }

  for (const c of data.codeChanges ?? []) {
    if (!c.author) {
      unassociated++;
      continue;
    }
    const r = resolve({ source: c.source, handle: c.author });
    if (r.id) linked.add(r.id);
  }

  for (const a of data.activity ?? []) {
    if (!a.author) {
      unassociated++;
      continue;
    }
    const r = resolve({ source: a.source, handle: a.author });
    if (r.id) linked.add(r.id);
  }

  return { participantsLinked: linked.size, unassociatedRecords: unassociated };
}
