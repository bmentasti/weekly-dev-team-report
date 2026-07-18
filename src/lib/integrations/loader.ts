import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import type { IntegrationType } from "@prisma/client";
import type { ConnectionContext } from "./types";

/**
 * Loads a connected integration for a workspace and returns the ConnectionContext
 * (non-secret config + decrypted secret). Returns null if not connected.
 */
export async function loadConnectionContext(
  projectId: string,
  type: IntegrationType,
): Promise<{ integrationId: string; ctx: ConnectionContext } | null> {
  const integration = await prisma.integration.findUnique({
    where: { projectId_type: { projectId, type } },
  });

  // Estados "usables": hay token y la conexión no está desactivada. Se intenta
  // el fetch incluso en PARTIALLY_SYNCED / SYNCING / RATE_LIMITED porque pueden
  // haberse recuperado; el resultado real del sync re-clasifica el estado.
  const USABLE: string[] = [
    "CONNECTED",
    "PARTIALLY_SYNCED",
    "SYNCING",
    "RATE_LIMITED",
  ];
  if (
    !integration ||
    !integration.encryptedAccessToken ||
    !USABLE.includes(integration.status as string)
  ) {
    return null;
  }

  const config =
    (integration.config as Record<string, string> | null) ?? {};

  return {
    integrationId: integration.id,
    ctx: { config, secret: decrypt(integration.encryptedAccessToken) },
  };
}
