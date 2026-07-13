import { safeFetch } from "@/lib/http";
import type { TestResult } from "../types";
// Helpers compartidos por los adapters de Project Planning & Portfolio.
// Mantienen el mapeo a UnifiedWorkItem consistente con el resto de providers.
import type { UnifiedWorkItem, WorkItemBucket } from "../types";
import type { ProviderSlug } from "../catalog";

const CRITICAL = new Set([
  "urgent",
  "high",
  "highest",
  "critical",
  "crítica",
  "alta",
]);

export function isCriticalPriority(priority: string | null | undefined): boolean {
  return priority ? CRITICAL.has(priority.toLowerCase()) : false;
}

/** Clasifica un estado de texto libre en el bucket unificado. */
export function planBucket(status: string, done = false): WorkItemBucket {
  const s = (status || "").toLowerCase();
  if (done) return "DONE";
  if (/block|bloque/.test(s)) return "BLOCKED";
  if (/done|complet|closed|finish|resuel|cerrad|archiv/.test(s)) return "DONE";
  if (/progress|doing|en curso|active|started|review|qa/.test(s))
    return "IN_PROGRESS";
  return "TODO";
}

/** Sin movimiento hace más de N días (solo aplica a ítems no terminados). */
export function isStale(updatedAtISO: string | null, done: boolean, days = 5): boolean {
  if (done || !updatedAtISO) return false;
  const ms = Date.now() - new Date(updatedAtISO).getTime();
  return ms / (1000 * 60 * 60 * 24) > days;
}

/** Construye un UnifiedWorkItem completando los campos no provistos con defaults. */
export function mkItem(
  p: Partial<UnifiedWorkItem> & {
    source: ProviderSlug;
    externalId: string;
    title: string;
    bucket: WorkItemBucket;
    url: string;
  },
): UnifiedWorkItem {
  return {
    status: "",
    assignee: null,
    priority: null,
    isCritical: false,
    isStale: false,
    storyPoints: null,
    labels: [],
    type: null,
    project: null,
    sprint: null,
    createdAt: null,
    updatedAt: null,
    resolvedAt: null,
    ...p,
  };
}

/** GET JSON con manejo de errores homogéneo. */
export async function getJson<T>(
  url: string,
  headers: Record<string, string>,
): Promise<T> {
  const res = await safeFetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`La API respondió ${res.status}.`);
  return (await res.json()) as T;
}

/** Mapea un código de estado HTTP a un TestResult de error legible. */
export function httpError(status: number, provider: string): string {
  if (status === 401 || status === 403) return "Token inválido o sin permisos.";
  if (status === 404) return "No se encontró el recurso (revisá los IDs).";
  return `${provider} respondió ${status}.`;
}

// ---------------------------------------------------------------------------
// INT-03: dedup del patrón testConnection + fetchData de los providers de
// Planning. Encapsulan el fetch (con timeout vía safeFetch), el chequeo de
// status y el manejo de error homogéneo. Los adapters pueden delegar en estos
// helpers en lugar de repetir el mismo try/catch en cada archivo.
// ---------------------------------------------------------------------------

/**
 * Ejecuta un GET de "ping" y lo mapea a un TestResult. Captura errores de red y
 * los devuelve como { ok: false }. `detail` es el mensaje de éxito.
 */
export async function testJson(
  url: string,
  headers: Record<string, string>,
  provider: string,
  detail = "Cuenta conectada",
): Promise<TestResult> {
  try {
    const res = await safeFetch(url, { headers, cache: "no-store" });
    if (!res.ok) return { ok: false, error: httpError(res.status, provider) };
    return { ok: true, detail };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error." };
  }
}

/**
 * GET JSON para fetchData: lanza un Error con el nombre del provider si el
 * status no es ok (lo captura el colector de reportes y marca la fuente en
 * error). Comparte timeout/cache con safeFetch.
 */
export async function fetchJson<T>(
  url: string,
  headers: Record<string, string>,
  provider: string,
): Promise<T> {
  const res = await safeFetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`${provider} devolvió ${res.status}.`);
  return (await res.json()) as T;
}
