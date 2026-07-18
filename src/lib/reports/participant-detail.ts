// Resolución del participante para la vista de DETALLE.
//
// Regla (auditoría §2/§3): la selección debe usar un identificador ESTABLE y
// único (id canónico), nunca el índice ni el nombre visible. Este módulo es PURO
// para poder testear el matcheo y la construcción de cuentas externas sin DB.

import type { AliasRecord, Resolver } from "./identity";
import { resolvePerson } from "./identity";
import type { PersonInsight } from "./types";

/** Cuenta externa de un participante (para explicar el vínculo). */
export interface IntegrationAccount {
  provider: string;
  externalUserId: string | null;
  username: string | null;
  email: string | null;
  verified: boolean;
  mappingSource: "provider-id" | "email" | "manual" | "suggested" | "username";
}

/** Id canónico ESTABLE de una fila de persona de un reporte. */
export function canonicalIdOf(
  person: { id?: string; name: string },
  resolve: Resolver,
): string {
  const r = resolvePerson(resolve, person);
  return r.id || person.name;
}

/**
 * ¿La fila `person` corresponde al participante `key`? `key` es preferentemente
 * el id canónico; se acepta el nombre visible SOLO como retro-compatibilidad
 * (links viejos), nunca el índice. La comparación se hace contra la identidad
 * canónica resuelta, así dos personas con el mismo nombre NO colisionan cuando
 * se navega por id.
 */
export function personMatchesKey(
  person: { id?: string; name: string },
  key: string,
  resolve: Resolver,
): boolean {
  const canonical = canonicalIdOf(person, resolve);
  if (canonical === key) return true;
  // Retro-compat: el key podría ser el id crudo guardado en el reporte.
  if (person.id && person.id === key) return true;
  // Retro-compat: link viejo por nombre visible (solo si no hay ambigüedad de id).
  if (person.name === key) return true;
  return false;
}

const EMAIL_ID_RE = /^email:(.+)$/;

function mapMethod(m?: string): IntegrationAccount["mappingSource"] {
  switch (m) {
    case "provider_id":
      return "provider-id";
    case "email_exact":
    case "email_alias":
      return "email";
    case "manual":
      return "manual";
    case "username":
      return "username";
    default:
      return "suggested";
  }
}

/**
 * Construye las cuentas externas del participante a partir de los alias de su
 * identidad canónica. Solo incluye los alias de ESA persona (por canonicalId).
 */
export function buildIntegrationAccounts(
  aliases: AliasRecord[],
  participantId: string,
): IntegrationAccount[] {
  return aliases
    .filter((a) => a.canonicalId === participantId)
    .map((a) => ({
      provider: a.source === "*" ? "manual" : a.source,
      externalUserId: a.externalUserId ?? null,
      username: null,
      email: null,
      verified: a.verified !== false,
      mappingSource: mapMethod(a.matchMethod),
    }));
}

/**
 * Deriva el email principal del participante: del id canónico si es un
 * `email:...`, o del primer alias de tipo email.
 */
export function primaryEmailOf(
  participantId: string,
  aliases: AliasRecord[],
): string | null {
  const m = participantId.match(EMAIL_ID_RE);
  if (m) return m[1];
  const emailAlias = aliases.find(
    (a) =>
      a.canonicalId === participantId &&
      (a.matchMethod === "email_exact" || a.matchMethod === "email_alias"),
  );
  if (emailAlias) {
    const em = emailAlias.handle.match(EMAIL_ID_RE);
    return em ? em[1] : emailAlias.handle.includes("@") ? emailAlias.handle : null;
  }
  return null;
}

export interface ParticipantSelection {
  /** Filas (una por reporte) que corresponden al participante, con su período. */
  matches: { periodEnd: Date; person: PersonInsight }[];
  participantId: string | null;
}

/**
 * Selecciona, entre los reportes, las filas que pertenecen al participante `key`,
 * resolviendo por identidad canónica. Devuelve el id canónico estable resuelto.
 */
export function selectParticipant(
  reports: { periodEnd: Date; people: PersonInsight[] }[],
  key: string,
  resolve: Resolver,
): ParticipantSelection {
  const matches: { periodEnd: Date; person: PersonInsight }[] = [];
  let participantId: string | null = null;
  for (const r of reports) {
    for (const p of r.people) {
      if (personMatchesKey(p, key, resolve)) {
        matches.push({ periodEnd: r.periodEnd, person: p });
        if (!participantId) participantId = canonicalIdOf(p, resolve);
      }
    }
  }
  return { matches, participantId };
}
