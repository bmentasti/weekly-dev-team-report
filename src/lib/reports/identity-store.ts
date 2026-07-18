// Acceso a la config de identidad canónica (PersonIdentity / PersonAlias).
//
// Nota: el cliente de Prisma se regenera con `prisma generate` (y la migración
// con `prisma migrate`). Hasta que eso corra en un entorno con la base, el
// cliente puede no conocer estos modelos ni sus campos nuevos, por lo que
// accedemos vía un puente tipado — mismo patrón ya usado en el repo (ver
// api/admin/users, report-configs). Todos los campos nuevos son opcionales y
// con default, así que las filas viejas siguen siendo válidas.

import { prisma } from "@/lib/prisma";
import type { AliasRecord, IdentityConfig, IdentityRecord, MatchMethod } from "./identity";

export interface PersonAliasRow {
  id: string;
  source: string;
  handle: string;
  identityId: string;
  externalUserId?: string | null;
  username?: string | null;
  email?: string | null;
  displayName?: string | null;
  matchMethod?: string | null;
  confidence?: number | null;
  verified?: boolean | null;
  verifiedAt?: Date | null;
  createdById?: string | null;
  createdByName?: string | null;
  reason?: string | null;
}

export interface PersonIdentityRow {
  id: string;
  key: string;
  displayName: string;
  email: string | null;
  aliases?: PersonAliasRow[];
}

type AliasData = {
  projectId: string;
  identityId: string;
  source: string;
  handle: string;
  externalUserId?: string | null;
  username?: string | null;
  email?: string | null;
  displayName?: string | null;
  matchMethod?: string;
  confidence?: number;
  verified?: boolean;
  verifiedAt?: Date | null;
  createdById?: string | null;
  createdByName?: string | null;
  reason?: string | null;
};

interface IdentityDelegate {
  findMany(args: {
    where: { projectId: string };
    include?: { aliases: boolean };
    orderBy?: { displayName: "asc" | "desc" };
  }): Promise<PersonIdentityRow[]>;
  upsert(args: {
    where: { projectId_key: { projectId: string; key: string } };
    create: { projectId: string; key: string; displayName: string; email?: string | null };
    update: { displayName: string; email?: string | null };
  }): Promise<PersonIdentityRow>;
  findFirst(args: {
    where: { projectId: string; id: string };
  }): Promise<PersonIdentityRow | null>;
  delete(args: { where: { id: string } }): Promise<PersonIdentityRow>;
}

interface AliasDelegate {
  create(args: { data: AliasData }): Promise<PersonAliasRow>;
  update(args: {
    where: { id: string };
    data: Partial<AliasData>;
  }): Promise<PersonAliasRow>;
  findFirst(args: {
    where: { projectId: string; id: string };
    include?: { identity: boolean };
  }): Promise<(PersonAliasRow & { identity?: PersonIdentityRow }) | null>;
  delete(args: { where: { id: string } }): Promise<PersonAliasRow>;
  deleteMany(args: { where: { identityId: string } }): Promise<{ count: number }>;
}

const db = prisma as unknown as {
  personIdentity: IdentityDelegate;
  personAlias: AliasDelegate;
};

function coerceMethod(m?: string | null): MatchMethod | undefined {
  const allowed: MatchMethod[] = [
    "email_exact",
    "email_alias",
    "manual",
    "provider_id",
    "username",
    "suggested",
  ];
  return m && (allowed as string[]).includes(m) ? (m as MatchMethod) : undefined;
}

/** Config de identidad del proyecto lista para construir el resolver. */
export async function getIdentityConfig(projectId: string): Promise<IdentityConfig> {
  let rows: PersonIdentityRow[];
  try {
    rows = await db.personIdentity.findMany({
      where: { projectId },
      include: { aliases: true },
    });
  } catch (err) {
    // Si las tablas todavía no existen (falta correr `prisma db push`/migrate)
    // o hay un error transitorio, degradamos a config vacía: sin unificación
    // manual, pero sin romper la generación de reportes ni la matriz.
    console.error("[identity] getIdentityConfig falló, uso config vacía:", err);
    return { identities: [], aliases: [] };
  }
  const identities: IdentityRecord[] = rows.map((r) => ({
    key: r.key,
    displayName: r.displayName,
  }));
  const aliases: AliasRecord[] = [];
  for (const r of rows) {
    for (const a of r.aliases ?? []) {
      aliases.push({
        source: a.source,
        handle: a.handle,
        canonicalId: r.key,
        displayName: a.displayName || r.displayName,
        externalUserId: a.externalUserId ?? null,
        matchMethod: coerceMethod(a.matchMethod),
        confidence: a.confidence ?? undefined,
        // `verified` ausente (filas viejas) = confirmada; sólo se excluye del
        // auto-link cuando es explícitamente false (sugerencia pendiente).
        verified: a.verified === false ? false : true,
      });
    }
  }
  return { identities, aliases };
}

/** Identidades del proyecto (para gestión en la UI). */
export async function listIdentities(projectId: string): Promise<PersonIdentityRow[]> {
  return db.personIdentity.findMany({
    where: { projectId },
    include: { aliases: true },
    orderBy: { displayName: "asc" },
  });
}

async function createAlias(data: AliasData): Promise<void> {
  try {
    await db.personAlias.create({ data });
  } catch {
    // Alias ya existente (unique projectId+source+handle) u otro error no fatal:
    // intentar actualizar los metadatos si podemos ubicarlo por handle es más
    // complejo; se ignora para no interrumpir la acción del usuario.
  }
}

export interface MergeActor {
  id?: string | null;
  name?: string | null;
}

/**
 * Fusiona varias personas en una identidad canónica. `primaryId` es el ID
 * canónico que se conserva; cada `mergeId` (distinto del primario) se registra
 * como alias hacia esa identidad.
 *
 * Por defecto la fusión es MANUAL (verified=true): la hace un admin. Los campos
 * de auditoría (`actor`, `reason`) quedan en el alias, además del AuditLog.
 */
export async function mergeIdentities(params: {
  projectId: string;
  primaryId: string;
  displayName: string;
  mergeIds: string[];
  email?: string | null;
  matchMethod?: MatchMethod;
  verified?: boolean;
  confidence?: number;
  actor?: MergeActor;
  reason?: string | null;
}): Promise<PersonIdentityRow> {
  const { projectId, primaryId, displayName, email } = params;
  const identity = await db.personIdentity.upsert({
    where: { projectId_key: { projectId, key: primaryId } },
    create: { projectId, key: primaryId, displayName, email: email ?? null },
    update: { displayName, email: email ?? null },
  });

  const method = params.matchMethod ?? "manual";
  const verified = params.verified ?? method !== "suggested";
  const targets = Array.from(
    new Set(params.mergeIds.map((m) => m.trim()).filter((m) => m && m !== primaryId)),
  );
  for (const handle of targets) {
    await createAlias({
      projectId,
      identityId: identity.id,
      source: "*",
      handle,
      matchMethod: method,
      verified,
      confidence: params.confidence ?? (verified ? 1 : 0.6),
      verifiedAt: verified ? new Date() : null,
      createdById: params.actor?.id ?? null,
      createdByName: params.actor?.name ?? null,
      reason: params.reason ?? null,
    });
  }
  return identity;
}

/**
 * Registra/actualiza el ID ESTABLE del proveedor para una identidad canónica.
 * Es lo que permite dejar de re-matchear por email/nombre en cada sync. Idempotente.
 */
export async function upsertExternalIdentity(params: {
  projectId: string;
  primaryId: string;
  displayName: string;
  source: string;
  externalUserId: string;
  username?: string | null;
  email?: string | null;
  providerDisplayName?: string | null;
  actor?: MergeActor;
}): Promise<void> {
  const identity = await db.personIdentity.upsert({
    where: { projectId_key: { projectId: params.projectId, key: params.primaryId } },
    create: {
      projectId: params.projectId,
      key: params.primaryId,
      displayName: params.displayName,
      email: params.email ?? null,
    },
    update: { displayName: params.displayName },
  });
  // El handle del alias es el ID estable (única clave que no cambia). Si ya
  // existe, se ignora el error de unicidad.
  await createAlias({
    projectId: params.projectId,
    identityId: identity.id,
    source: params.source,
    handle: params.externalUserId,
    externalUserId: params.externalUserId,
    username: params.username ?? null,
    email: params.email ?? null,
    displayName: params.providerDisplayName ?? null,
    matchMethod: "provider_id",
    verified: true,
    confidence: 1,
    verifiedAt: new Date(),
    createdById: params.actor?.id ?? null,
    createdByName: params.actor?.name ?? null,
  });
}

/** Confirma una sugerencia pendiente (verified=false → true). */
export async function confirmAlias(
  projectId: string,
  aliasId: string,
  actor?: MergeActor,
): Promise<PersonAliasRow | null> {
  const found = await db.personAlias.findFirst({ where: { projectId, id: aliasId } });
  if (!found) return null;
  return db.personAlias.update({
    where: { id: aliasId },
    data: {
      verified: true,
      verifiedAt: new Date(),
      createdById: actor?.id ?? found.createdById ?? null,
      createdByName: actor?.name ?? found.createdByName ?? null,
    },
  });
}

/** Desvincula (elimina) un alias puntual. Devuelve el alias eliminado. */
export async function unlinkAlias(
  projectId: string,
  aliasId: string,
): Promise<PersonAliasRow | null> {
  const found = await db.personAlias.findFirst({ where: { projectId, id: aliasId } });
  if (!found) return null;
  await db.personAlias.delete({ where: { id: aliasId } });
  return found;
}

/** Deshace una fusión: elimina la identidad y sus alias (los handles vuelven a separarse). */
export async function deleteIdentity(projectId: string, id: string): Promise<boolean> {
  const found = await db.personIdentity.findFirst({ where: { projectId, id } });
  if (!found) return false;
  await db.personAlias.deleteMany({ where: { identityId: id } });
  await db.personIdentity.delete({ where: { id } });
  return true;
}
