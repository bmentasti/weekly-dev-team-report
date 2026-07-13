// Acceso a la config de identidad canónica (PersonIdentity / PersonAlias).
//
// Nota: el cliente de Prisma se regenera con `prisma generate` (y la migración
// con `prisma migrate`). Hasta que eso corra en un entorno con la base, el
// cliente puede no conocer estos modelos, por lo que accedemos vía un puente
// tipado — mismo patrón ya usado en el repo (ver api/admin/users, report-configs).

import { prisma } from "@/lib/prisma";
import type { AliasRecord, IdentityConfig, IdentityRecord } from "./identity";

export interface PersonAliasRow {
  id: string;
  source: string;
  handle: string;
  identityId: string;
}

export interface PersonIdentityRow {
  id: string;
  key: string;
  displayName: string;
  email: string | null;
  aliases?: PersonAliasRow[];
}

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
  create(args: {
    data: { projectId: string; identityId: string; source: string; handle: string };
  }): Promise<PersonAliasRow>;
  deleteMany(args: { where: { identityId: string } }): Promise<{ count: number }>;
}

const db = prisma as unknown as {
  personIdentity: IdentityDelegate;
  personAlias: AliasDelegate;
};

/** Config de identidad del proyecto lista para construir el resolver. */
export async function getIdentityConfig(projectId: string): Promise<IdentityConfig> {
  const rows = await db.personIdentity.findMany({
    where: { projectId },
    include: { aliases: true },
  });
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
        displayName: r.displayName,
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

/**
 * Fusiona varias personas en una identidad canónica. `primaryId` es el ID
 * canónico que se conserva; cada `mergeId` (distinto del primario) se registra
 * como alias hacia esa identidad.
 */
export async function mergeIdentities(params: {
  projectId: string;
  primaryId: string;
  displayName: string;
  mergeIds: string[];
  email?: string | null;
}): Promise<PersonIdentityRow> {
  const { projectId, primaryId, displayName, email } = params;
  const identity = await db.personIdentity.upsert({
    where: { projectId_key: { projectId, key: primaryId } },
    create: { projectId, key: primaryId, displayName, email: email ?? null },
    update: { displayName, email: email ?? null },
  });

  const targets = Array.from(
    new Set(params.mergeIds.map((m) => m.trim()).filter((m) => m && m !== primaryId)),
  );
  for (const handle of targets) {
    try {
      await db.personAlias.create({
        data: { projectId, identityId: identity.id, source: "*", handle },
      });
    } catch {
      // Alias ya existente (unique projectId+source+handle): ignorar.
    }
  }
  return identity;
}

/** Deshace una fusión: elimina la identidad y sus alias (los handles vuelven a separarse). */
export async function deleteIdentity(projectId: string, id: string): Promise<boolean> {
  const found = await db.personIdentity.findFirst({ where: { projectId, id } });
  if (!found) return false;
  await db.personAlias.deleteMany({ where: { identityId: id } });
  await db.personIdentity.delete({ where: { id } });
  return true;
}
