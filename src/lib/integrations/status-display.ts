// Presentación de la salud de una integración en la UI.
//
// Mapea cada estado de sincronización a su clave i18n y a un "tono" visual
// (color del punto/badge). Es puro y compartible entre server y client.

import type { SyncStatus } from "./health";

export type StatusTone = "success" | "warning" | "destructive" | "muted" | "info";

/** Clave i18n del label de cada estado (definida en dict/workspace.ts). */
export const STATUS_LABEL_KEY: Record<SyncStatus, string> = {
  NOT_CONNECTED: "ws.integrations.status.NOT_CONNECTED",
  CONNECTING: "ws.integrations.status.CONNECTING",
  CONNECTED: "ws.integrations.status.CONNECTED",
  SYNCING: "ws.integrations.status.SYNCING",
  PARTIALLY_SYNCED: "ws.integrations.status.PARTIALLY_SYNCED",
  PERMISSION_REQUIRED: "ws.integrations.status.PERMISSION_REQUIRED",
  TOKEN_EXPIRED: "ws.integrations.status.TOKEN_EXPIRED",
  RATE_LIMITED: "ws.integrations.status.RATE_LIMITED",
  FAILED: "ws.integrations.status.FAILED",
  DISCONNECTED: "ws.integrations.status.DISCONNECTED",
  ERROR: "ws.integrations.status.ERROR",
};

/** Tono visual por estado. */
export function statusTone(status: SyncStatus): StatusTone {
  switch (status) {
    case "CONNECTED":
      return "success";
    case "SYNCING":
    case "CONNECTING":
      return "info";
    case "PARTIALLY_SYNCED":
    case "RATE_LIMITED":
      return "warning";
    case "PERMISSION_REQUIRED":
    case "TOKEN_EXPIRED":
    case "FAILED":
    case "ERROR":
      return "destructive";
    default:
      return "muted";
  }
}

/** ¿El estado indica que la integración está operativa (trae datos)? */
export function isHealthy(status: SyncStatus): boolean {
  return status === "CONNECTED";
}

/** ¿El estado requiere acción del usuario? */
export function needsAttention(status: SyncStatus): boolean {
  return (
    status === "PERMISSION_REQUIRED" ||
    status === "TOKEN_EXPIRED" ||
    status === "FAILED" ||
    status === "ERROR" ||
    status === "PARTIALLY_SYNCED"
  );
}

/** Clases Tailwind para el punto de estado según tono. */
export const TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  info: "bg-primary",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

/** Clases Tailwind para el texto de estado según tono. */
export const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-success",
  info: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};
