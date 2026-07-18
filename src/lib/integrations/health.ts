// Salud REAL de una integración.
//
// Regla del spec: una integración NO está sana solo porque la autenticación
// funcionó; también tiene que poder RECUPERAR y PROCESAR datos. Este módulo
// clasifica el resultado de un intento de sync en un estado accionable y expone
// un mensaje comprensible + la acción recomendada para resolverlo.
//
// Es un módulo PURO (sin Prisma) para poder testearlo de forma aislada.

import type { ProviderData } from "./types";

/** Estados posibles (espejo del enum IntegrationStatus de Prisma). */
export type SyncStatus =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "SYNCING"
  | "PARTIALLY_SYNCED"
  | "PERMISSION_REQUIRED"
  | "TOKEN_EXPIRED"
  | "RATE_LIMITED"
  | "FAILED"
  | "DISCONNECTED"
  | "ERROR";

export interface SyncClassification {
  status: SyncStatus;
  /** Mensaje comprensible para el usuario. */
  lastErrorMessage: string;
  /** Qué debería hacer el usuario para resolverlo. */
  recommendedAction: string;
  /** Scopes/permisos que faltan (si se pudieron inferir). */
  missingPermissions: string[];
}

/** Intenta extraer un status HTTP de un error de adapter (heterogéneo). */
export function httpStatusOf(err: unknown): number | null {
  if (err && typeof err === "object") {
    const anyErr = err as { status?: unknown; statusCode?: unknown; code?: unknown };
    for (const v of [anyErr.status, anyErr.statusCode, anyErr.code]) {
      if (typeof v === "number" && v >= 100 && v < 600) return v;
    }
  }
  const msg = err instanceof Error ? err.message : String(err ?? "");
  // "... 429 ...", "HTTP 403", "status 401", etc.
  const m = msg.match(/\b(4\d\d|5\d\d)\b/);
  if (m) return Number(m[1]);
  return null;
}

function isTimeout(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err ?? "").toLowerCase();
  return name === "HttpTimeoutError" || name === "TimeoutError" || msg.includes("timeout");
}

/**
 * Clasifica un error de sincronización en un estado accionable. Diferencia
 * token vencido, permisos insuficientes, rate limit y fallo genérico.
 */
export function classifySyncError(err: unknown, providerLabel = "la integración"): SyncClassification {
  const status = httpStatusOf(err);
  const raw = err instanceof Error ? err.message : String(err ?? "Error desconocido");

  if (status === 401) {
    return {
      status: "TOKEN_EXPIRED",
      lastErrorMessage: `${providerLabel} rechazó las credenciales (401): el token venció o fue revocado.`,
      recommendedAction: "Reconectá la integración con un token nuevo.",
      missingPermissions: [],
    };
  }
  if (status === 403) {
    return {
      status: "PERMISSION_REQUIRED",
      lastErrorMessage: `${providerLabel} devolvió 403: el token no tiene permisos suficientes para leer estos datos.`,
      recommendedAction:
        "Otorgá al token los scopes/permisos necesarios (acceso al repo/proyecto/workspace) y reconectá.",
      missingPermissions: [],
    };
  }
  if (status === 429) {
    return {
      status: "RATE_LIMITED",
      lastErrorMessage: `${providerLabel} aplicó rate limit (429). La sincronización se reintentará más tarde.`,
      recommendedAction: "Esperá unos minutos; el próximo sync se reintenta automáticamente.",
      missingPermissions: [],
    };
  }
  if (status === 404) {
    return {
      status: "FAILED",
      lastErrorMessage: `${providerLabel} devolvió 404: el recurso seleccionado (repo/proyecto/board) no existe o no es accesible.`,
      recommendedAction: "Verificá que el proyecto/repositorio configurado sea correcto.",
      missingPermissions: [],
    };
  }
  if (status && status >= 500) {
    return {
      status: "FAILED",
      lastErrorMessage: `${providerLabel} tuvo un error del lado del servidor (${status}).`,
      recommendedAction: "Es transitorio: reintentá más tarde. Si persiste, revisá el estado del proveedor.",
      missingPermissions: [],
    };
  }
  if (isTimeout(err)) {
    return {
      status: "FAILED",
      lastErrorMessage: `${providerLabel} no respondió a tiempo (timeout).`,
      recommendedAction: "Reintentá; si persiste, puede haber lentitud o un firewall bloqueando la conexión.",
      missingPermissions: [],
    };
  }
  return {
    status: "FAILED",
    lastErrorMessage: `Error al sincronizar ${providerLabel}: ${raw}`,
    recommendedAction: "Revisá la configuración de la conexión y reintentá.",
    missingPermissions: [],
  };
}

export interface DataSummary {
  recordsImported: number;
  workItems: number;
  codeChanges: number;
  activity: number;
  ciRuns: number;
  personEmails: number;
}

/** Cuenta cuántos registros trajo un sync (para exponer salud real). */
export function summarizeData(data: ProviderData | null | undefined): DataSummary {
  const workItems = data?.workItems?.length ?? 0;
  const codeChanges = data?.codeChanges?.length ?? 0;
  const activity = data?.activity?.length ?? 0;
  const ciRuns = data?.ciRuns?.length ?? 0;
  const personEmails = data?.personEmails?.length ?? 0;
  return {
    recordsImported: workItems + codeChanges + activity + ciRuns,
    workItems,
    codeChanges,
    activity,
    ciRuns,
    personEmails,
  };
}

/**
 * Decide el estado tras un sync EXITOSO (sin excepción). Un sync que no trae
 * ningún registro no es necesariamente un error, pero se marca como
 * PARTIALLY_SYNCED con una advertencia para que el usuario revise el recurso.
 */
export function classifySyncSuccess(
  summary: DataSummary,
  providerLabel = "la integración",
): SyncClassification {
  if (summary.recordsImported === 0) {
    return {
      status: "PARTIALLY_SYNCED",
      lastErrorMessage: `${providerLabel} conectó pero no devolvió registros en el período consultado.`,
      recommendedAction:
        "Verificá que el proyecto/repositorio seleccionado sea el correcto y que el token tenga acceso a sus datos.",
      missingPermissions: [],
    };
  }
  return {
    status: "CONNECTED",
    lastErrorMessage: "",
    recommendedAction: "",
    missingPermissions: [],
  };
}
