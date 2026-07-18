// Persistencia de la SALUD de sincronización de una integración.
//
// Escribe los campos nuevos del modelo Integration (lastSuccessfulSyncAt,
// recordsImported, lastErrorMessage, recommendedAction, missingPermissions,
// healthDetail, status…). Best-effort y vía puente tipado: si el cliente de
// Prisma todavía no conoce los campos (falta `prisma generate`/`db push`), no
// rompe el flujo principal — solo se pierde el registro de salud hasta migrar.

import { prisma } from "@/lib/prisma";
import type { SyncClassification, DataSummary } from "./health";

interface IntegrationWriteDelegate {
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
}

function model(): IntegrationWriteDelegate | undefined {
  return (prisma as unknown as { integration?: IntegrationWriteDelegate }).integration;
}

async function safeUpdate(id: string, data: Record<string, unknown>): Promise<void> {
  const m = model();
  if (!m) return;
  try {
    await m.update({ where: { id }, data });
  } catch (err) {
    // Campos aún inexistentes (pre-migración) u otro error no fatal: reintentar
    // con el subconjunto mínimo (solo `status`, que ya existe hace tiempo).
    if (data.status) {
      try {
        await m.update({ where: { id }, data: { status: data.status } });
      } catch {
        /* nada más que hacer */
      }
    }
    console.error("[sync-store] no se pudo registrar la salud del sync:", err);
  }
}

/** Marca el inicio de un intento de sincronización. */
export async function recordSyncAttempt(integrationId: string): Promise<void> {
  await safeUpdate(integrationId, {
    status: "SYNCING",
    lastSyncAttemptAt: new Date(),
  });
}

/** Registra un sync exitoso con la salud real (contadores + estado). */
export async function recordSyncSuccess(
  integrationId: string,
  cls: SyncClassification,
  summary: DataSummary,
  extra?: { participantsLinked?: number; pendingIdentities?: number; unassociatedRecords?: number },
): Promise<void> {
  const now = new Date();
  await safeUpdate(integrationId, {
    status: cls.status,
    lastSyncAttemptAt: now,
    lastSuccessfulSyncAt: now,
    recordsImported: summary.recordsImported,
    lastErrorMessage: cls.lastErrorMessage || null,
    recommendedAction: cls.recommendedAction || null,
    missingPermissions: cls.missingPermissions,
    participantsLinked: extra?.participantsLinked ?? null,
    pendingIdentities: extra?.pendingIdentities ?? null,
    unassociatedRecords: extra?.unassociatedRecords ?? null,
    healthDetail: {
      ...summary,
      classifiedAt: now.toISOString(),
    },
  });
}

/** Registra un sync fallido con estado accionable (token/permiso/rate limit/…). */
export async function recordSyncFailure(
  integrationId: string,
  cls: SyncClassification,
): Promise<void> {
  await safeUpdate(integrationId, {
    status: cls.status,
    lastSyncAttemptAt: new Date(),
    lastErrorMessage: cls.lastErrorMessage || null,
    recommendedAction: cls.recommendedAction || null,
    missingPermissions: cls.missingPermissions,
  });
}
