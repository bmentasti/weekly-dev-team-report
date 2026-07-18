// Estado explícito de una métrica (auditoría §6).
//
// Regla dura: NUNCA convertir null/undefined/errores/falta de integración en 0.
// Un 0 real (hubo datos y el resultado es cero) es distinto de "sin datos",
// "no vinculada", "error de sync", etc. Este módulo es PURO y testeable.

export type MetricState =
  | "value" // hay dato y es un número real (incluye 0 real)
  | "no_data" // la integración no devolvió información
  | "na" // la métrica no aplica a esta persona/rol
  | "not_linked" // la persona no tiene cuenta en la integración que la alimenta
  | "sync_error" // la integración falló al sincronizar
  | "partial"; // solo se obtuvo parte del período

export interface MetricValue {
  state: MetricState;
  /** Número solo cuando state === "value"; en el resto es null. */
  value: number | null;
}

export interface MetricContext {
  /** ¿La integración que alimenta la métrica está conectada? */
  providerConnected: boolean;
  /** ¿La persona tiene una cuenta vinculada en esa integración? */
  personLinked: boolean;
  /** ¿Hubo error de sincronización en esa integración? */
  syncError?: boolean;
  /** ¿El período se sincronizó solo parcialmente? */
  partial?: boolean;
  /** ¿La métrica aplica a esta persona/rol? (default: sí) */
  applicable?: boolean;
}

/**
 * Clasifica un valor crudo en un MetricValue respetando la jerarquía de estados.
 * `raw` puede ser number | null | undefined. Un 0 real solo se reporta como
 * "value" si además hay datos (provider conectado y persona vinculada).
 */
export function classifyMetric(
  raw: number | null | undefined,
  ctx: MetricContext,
): MetricValue {
  if (ctx.applicable === false) return { state: "na", value: null };
  if (ctx.syncError) return { state: "sync_error", value: null };
  if (!ctx.providerConnected) return { state: "no_data", value: null };
  if (!ctx.personLinked) return { state: "not_linked", value: null };
  if (raw === null || raw === undefined || Number.isNaN(raw))
    return { state: "no_data", value: null };
  if (ctx.partial) return { state: "partial", value: raw };
  return { state: "value", value: raw };
}

/** Claves i18n por estado (definidas en dict/workspace.ts). */
export const METRIC_STATE_KEY: Record<Exclude<MetricState, "value" | "partial">, string> = {
  no_data: "ws.metric.noData",
  na: "ws.metric.na",
  not_linked: "ws.metric.notLinked",
  sync_error: "ws.metric.syncError",
};

/**
 * Texto a mostrar. Para "value" devuelve el número; para "partial" el número con
 * un asterisco (parcial); para el resto, la etiqueta traducida del estado.
 */
export function formatMetric(mv: MetricValue, t: (k: string) => string): string {
  if (mv.state === "value") return String(mv.value);
  if (mv.state === "partial") return `${mv.value}*`;
  return t(METRIC_STATE_KEY[mv.state]);
}

/** ¿El valor es "confiable" para sumar/graficar? (solo value/partial). */
export function isUsable(mv: MetricValue): boolean {
  return mv.state === "value" || mv.state === "partial";
}
