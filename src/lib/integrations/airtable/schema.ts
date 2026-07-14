// ---------------------------------------------------------------------------
// Detección dinámica de la estructura de una tabla de Airtable
// ---------------------------------------------------------------------------
//
// Obtiene las columnas REALES de la tabla elegida (nombre, tipo, si admite
// múltiples valores, si es un vínculo a otra tabla) más una muestra de valores
// y estadísticas de completitud. Con esto la UI puede ofrecer el mapeo
// configurable y las sugerencias, sin depender de nombres de columna fijos.
//
// Estrategia:
//   1) Metadata API (scope schema.bases:read): fuente autoritativa de tipos,
//      multi-valor y vínculos.
//   2) Si no hay acceso al esquema, se infieren las columnas a partir de una
//      muestra de registros (sin tipos precisos, pero suficiente para mapear).

import { safeFetch } from "@/lib/http";
import type { ColumnDescriptor, FieldSuggestion } from "./mapping";
import { suggestFieldMapping } from "./mapping";

const API = "https://api.airtable.com/v0";
const SAMPLE_SIZE = 25;

interface MetaField {
  id: string;
  name: string;
  type: string;
  options?: { linkedTableId?: string; isReversed?: boolean };
}
interface MetaTable {
  id: string;
  name: string;
  primaryFieldId?: string;
  fields: MetaField[];
}
interface RawRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

const LINK_TYPES = new Set(["multipleRecordLinks", "singleRecordLink"]);
const MULTI_TYPES = new Set([
  "multipleRecordLinks",
  "multipleSelects",
  "multipleCollaborators",
  "multipleAttachments",
  "multipleLookupValues",
]);

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as { name?: string; email?: string; url?: string };
    return o.name ?? o.email ?? o.url ?? "";
  }
  return String(v);
}

function isMulti(v: unknown): boolean {
  return Array.isArray(v) && v.length > 1;
}

async function fetchSchema(
  baseId: string,
  token: string,
): Promise<MetaTable[] | null> {
  try {
    const res = await safeFetch(`${API}/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tables?: MetaTable[] };
    return data.tables ?? null;
  } catch {
    return null;
  }
}

async function fetchSample(
  baseId: string,
  table: string,
  token: string,
): Promise<RawRecord[]> {
  const res = await safeFetch(
    `${API}/${baseId}/${encodeURIComponent(table)}?pageSize=${SAMPLE_SIZE}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(
      `Airtable devolvió ${res.status} al leer la tabla. ${detail.slice(0, 160)}`,
    );
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data = (await res.json()) as { records?: RawRecord[] };
  return data.records ?? [];
}

export interface TableDescription {
  table: string;
  columns: ColumnDescriptor[];
  suggestions: FieldSuggestion[];
  /** true si NO se pudo leer el esquema (falta scope schema.bases:read). */
  schemaBlocked: boolean;
  /** Advertencias accionables para mostrar al usuario. */
  warnings: string[];
}

/**
 * Describe la estructura de una tabla: columnas con tipo, muestras y stats, más
 * el mapeo sugerido. Nunca lanza por falta de una columna con nombre fijo.
 */
export async function describeTable(
  baseId: string,
  table: string,
  token: string,
): Promise<TableDescription> {
  const warnings: string[] = [];
  const [schema, sample] = await Promise.all([
    fetchSchema(baseId, token),
    fetchSample(baseId, table, token),
  ]);

  const sampleCount = sample.length;
  const columns: ColumnDescriptor[] = [];

  const metaTable = schema?.find((t) => t.name === table);
  const schemaBlocked = schema === null;

  if (metaTable) {
    for (const fld of metaTable.fields) {
      const values = sample
        .map((r) => r.fields?.[fld.name])
        .filter((v) => v != null && toStr(v).trim() !== "");
      const samples = values.slice(0, 5).map(toStr).filter(Boolean);
      columns.push({
        name: fld.name,
        type: fld.type,
        samples,
        sampleCount,
        filledCount: values.length,
        multiValue:
          MULTI_TYPES.has(fld.type) || sample.some((r) => isMulti(r.fields?.[fld.name])),
        linked: LINK_TYPES.has(fld.type),
        linkedTableId: fld.options?.linkedTableId,
      });
    }
  } else {
    if (schemaBlocked) {
      warnings.push(
        "El token no tiene el scope schema.bases:read: no se pueden leer tipos ni vínculos con precisión. Se infirieron las columnas a partir de una muestra de registros. Agregá el scope para un mapeo más confiable.",
      );
    }
    // Inferir columnas desde la muestra de registros.
    const seen = new Map<string, unknown[]>();
    for (const r of sample) {
      for (const [k, v] of Object.entries(r.fields ?? {})) {
        if (v == null || toStr(v).trim() === "") continue;
        (seen.get(k) ?? seen.set(k, []).get(k)!).push(v);
      }
    }
    for (const [name, values] of seen) {
      columns.push({
        name,
        type: "unknown",
        samples: values.slice(0, 5).map(toStr).filter(Boolean),
        sampleCount,
        filledCount: values.length,
        multiValue: values.some(isMulti),
        linked: false,
      });
    }
  }

  if (columns.length === 0) {
    warnings.push(
      "La tabla no devolvió columnas con datos en la muestra. Verificá que la tabla tenga registros y que el token tenga acceso.",
    );
  }

  const suggestions = suggestFieldMapping(columns);

  // Advertencias accionables sobre campos clave sin candidata clara.
  const byField = new Map(suggestions.map((s) => [s.field, s]));
  const name = byField.get("collaboratorName");
  const email = byField.get("email");
  const assignee = byField.get("assignee");
  if (name && !name.column && assignee && !assignee.column) {
    warnings.push(
      "No se detectó automáticamente ni el nombre del colaborador ni el responsable. Seleccioná manualmente qué columnas usar.",
    );
  }
  if (email && email.column && email.confidence !== "alta") {
    warnings.push(
      `La columna sugerida como correo ("${email.column}") no es concluyente: confirmala antes de sincronizar.`,
    );
  }

  return { table, columns, suggestions, schemaBlocked, warnings };
}
