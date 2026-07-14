import { safeFetch } from "@/lib/http";
import type {
  ProviderAdapter,
  UnifiedWorkItem,
  WorkItemBucket,
} from "../types";
import {
  bestColumnByName,
  parseFieldMap,
  type DevMetricsField,
  type FieldMap,
} from "@/lib/integrations/airtable/mapping";

// Airtable adapter — maps records of a table to unified WorkItems.
// Auth: Personal Access Token (data.records:read) via Bearer header.

const API = "https://api.airtable.com/v0";
const STALE_DAYS = 5;

const DONE = /\b(done|closed|complete|completed|shipped|listo|finalizad|terminad)\b/i;
const IN_PROGRESS = /\b(in progress|doing|wip|review|en progreso|en curso|haciendo)\b/i;
const BLOCKED = /\b(blocked|bloquead|on hold|en espera)\b/i;
const CRITICAL = /\b(high|highest|urgent|critical|cr[ií]tic|alta|urgente)\b/i;

function field(config: Record<string, string>, key: string, fallback: string) {
  return config[key]?.trim() || fallback;
}

interface RawRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as { name?: string; email?: string };
    return o.name ?? o.email ?? "";
  }
  return String(v);
}

// Record id opaco de Airtable ("rec" + 14+ alfanuméricos).
const RECORD_ID_RE = /^rec[A-Za-z0-9]{14,}$/;

function looksLikeRecordId(s: string): boolean {
  return RECORD_ID_RE.test(s.trim());
}

/**
 * Resuelve el valor crudo de un campo de responsable a un nombre legible.
 * - Colaboradores / objetos: usa name/email (vía toStr).
 * - Registros vinculados (record ids): los mapea con `nameById` si está
 *   disponible; si no, deja el record id (el resto del pipeline igual lo
 *   unifica por identidad).
 */
export function resolveAssignees(
  raw: unknown,
  nameById: Map<string, string>,
): string[] {
  const mapOne = (val: unknown): string => {
    if (typeof val === "string") {
      const s = val.trim();
      if (looksLikeRecordId(s)) return nameById.get(s) || s;
      return s;
    }
    return toStr(val);
  };
  const names = (Array.isArray(raw) ? raw : [raw])
    .map(mapOne)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(names));
}

/** Compat: primer responsable (o null). El listado completo va en `assignees`. */
export function resolveAssignee(
  raw: unknown,
  nameById: Map<string, string>,
): string | null {
  return resolveAssignees(raw, nameById)[0] ?? null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))
    return Number(v);
  return null;
}

function bucketFor(status: string): WorkItemBucket {
  if (BLOCKED.test(status)) return "BLOCKED";
  if (DONE.test(status)) return "DONE";
  if (IN_PROGRESS.test(status)) return "IN_PROGRESS";
  return "TODO";
}

async function atFetch(
  baseId: string,
  table: string,
  token: string,
  query = "",
): Promise<Response> {
  const url = `${API}/${baseId}/${encodeURIComponent(table)}${query}`;
  return safeFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

// Tope defensivo para no traer bases enormes completas.
const MAX_RECORDS = 500;

/**
 * Trae todos los records paginando (Airtable devuelve `offset` mientras haya
 * más páginas). Si se pasa `since`, filtra server-side por fecha de creación o
 * última modificación para respetar el período del reporte.
 */
async function atFetchAll(
  baseId: string,
  table: string,
  token: string,
  since?: string,
): Promise<RawRecord[]> {
  const params = new URLSearchParams({ pageSize: "100" });
  if (since) {
    // ISO 8601 no contiene comillas simples, es seguro interpolarlo.
    params.set(
      "filterByFormula",
      `OR(IS_AFTER(CREATED_TIME(), '${since}'), IS_AFTER(LAST_MODIFIED_TIME(), '${since}'))`,
    );
  }

  const records: RawRecord[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams(params);
    if (offset) qs.set("offset", offset);
    const res = await atFetch(baseId, table, token, `?${qs.toString()}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Airtable devolvió ${res.status}. ${detail.slice(0, 160)}`,
      );
    }
    const data = (await res.json()) as {
      records?: RawRecord[];
      offset?: string;
    };
    records.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset && records.length < MAX_RECORDS);

  return records;
}

// --- Resolución automática de responsables vinculados (Metadata API) --------

interface MetaField {
  id: string;
  name: string;
  type: string;
  options?: { linkedTableId?: string };
}
interface MetaTable {
  id: string;
  name: string;
  primaryFieldId?: string;
  fields: MetaField[];
}

/** Esquema de la base (requiere scope schema.bases:read). null si no hay acceso. */
async function fetchBaseSchema(
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

/**
 * Construye el mapa record id -> nombre real para el campo de responsable.
 * Estrategia:
 *   1) Metadata API: detecta automáticamente la tabla vinculada del campo y su
 *      campo primario (sin config manual, si el token tiene schema.bases:read).
 *   2) Fallback: la tabla configurada manualmente (assigneeTableName).
 * Si nada aplica, devuelve un mapa vacío (los record ids quedan como están).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickEmail(f: Record<string, unknown>): string | null {
  for (const k of ["Email", "email", "E-mail", "Mail", "Correo"]) {
    const v = toStr(f[k]).trim();
    if (EMAIL_RE.test(v)) return v.toLowerCase();
  }
  // Cualquier campo cuyo valor parezca un email.
  for (const v of Object.values(f)) {
    const s = toStr(v).trim();
    if (EMAIL_RE.test(s)) return s.toLowerCase();
  }
  return null;
}

interface AssigneeDirectory {
  /** record id → nombre real. */
  nameById: Map<string, string>;
  /** record id → email (si la tabla de personas lo tiene). */
  emailById: Map<string, string>;
  /** true si NO se pudo leer el esquema (falta scope schema.bases:read). */
  schemaBlocked: boolean;
}

/** Nombre "humano" de un record de una tabla, usando su campo primario. */
function recordName(
  f: Record<string, unknown>,
  primaryFieldName: string | undefined,
): string {
  return (
    (primaryFieldName ? toStr(f[primaryFieldName]) : "") ||
    toStr(f["Name"]) ||
    toStr(f["Full Name"]) ||
    toStr(f["Nombre"]) ||
    toStr(f["Title"]) ||
    toStr(f["Email"])
  ).trim();
}

// Tope defensivo de tablas a escanear para resolver record ids.
const MAX_LINKED_TABLES = 25;

/**
 * Construye un directorio GLOBAL record id → nombre/email escaneando las tablas
 * de la base (los record ids son únicos dentro de la base, así que un id de
 * responsable se resuelve sin depender de conocer el nombre exacto del campo o
 * de la tabla vinculada). Requiere scope `schema.bases:read`; si falta, marca
 * `schemaBlocked` y cae al fallback por config.
 */
async function buildAssigneeNameMap(
  baseId: string,
  token: string,
  cfgTable: string,
  cfgNameField: string,
): Promise<AssigneeDirectory> {
  const nameById = new Map<string, string>();
  const emailById = new Map<string, string>();

  const schema = await fetchBaseSchema(baseId, token);

  const ingest = (
    recs: RawRecord[],
    primaryFieldName: string | undefined,
    nameFieldOverride?: string,
  ) => {
    for (const rec of recs) {
      const f = rec.fields ?? {};
      const nm = nameFieldOverride
        ? toStr(f[nameFieldOverride]) || recordName(f, primaryFieldName)
        : recordName(f, primaryFieldName);
      if (nm) nameById.set(rec.id, nm);
      const email = pickEmail(f);
      if (email) emailById.set(rec.id, email);
    }
  };

  if (schema) {
    // Modo automático: mapa global desde todas las tablas (acotado).
    for (const tbl of schema.slice(0, MAX_LINKED_TABLES)) {
      const primary = tbl.fields.find((fl) => fl.id === tbl.primaryFieldId);
      try {
        const recs = await atFetchAll(baseId, tbl.name, token);
        ingest(recs, primary?.name);
      } catch {
        // ignorar tabla que no se pueda leer.
      }
    }
    return { nameById, emailById, schemaBlocked: false };
  }

  // Sin acceso a esquema: fallback a la tabla de personas configurada a mano.
  if (cfgTable) {
    try {
      const recs = await atFetchAll(baseId, cfgTable, token);
      ingest(recs, undefined, cfgNameField);
    } catch {
      // permisos / tabla inexistente.
    }
    return { nameById, emailById, schemaBlocked: false };
  }

  // Ni esquema ni config: no se pueden resolver los record ids.
  return { nameById, emailById, schemaBlocked: true };
}

export const airtableAdapter: ProviderAdapter = {
  slug: "airtable",
  async testConnection(ctx) {
    const baseId = ctx.config.baseId?.trim() ?? "";
    const table = ctx.config.tableName?.trim() ?? "";
    if (!baseId.startsWith("app"))
      return { ok: false, error: "El Base ID debe empezar con 'app'." };
    if (!table) return { ok: false, error: "Indicá el nombre de la tabla." };
    try {
      const res = await atFetch(baseId, table, ctx.secret, "?maxRecords=1");
      if (res.status === 401)
        return { ok: false, error: "Token inválido o sin permisos." };
      if (res.status === 403)
        return { ok: false, error: "El token no tiene acceso a esta base." };
      if (res.status === 404)
        return { ok: false, error: "No se encontró la base o la tabla." };
      if (!res.ok)
        return { ok: false, error: `Airtable respondió ${res.status}.` };
      // Avisamos si el token puede resolver nombres de personas (scope de esquema).
      const schema = await fetchBaseSchema(baseId, ctx.secret);
      const detail = schema
        ? `Tabla "${table}" · nombres de personas: automáticos`
        : `Tabla "${table}" · agregá el scope schema.bases:read al token para mostrar nombres reales (hoy verías record ids)`;
      return { ok: true, detail };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Error de red con Airtable: ${err.message}`
            : "Error desconocido con Airtable.",
      };
    }
  },

  async fetchData(ctx, opts) {
    const baseId = ctx.config.baseId?.trim() ?? "";
    const table = ctx.config.tableName?.trim() ?? "";
    const assigneeTable = ctx.config.assigneeTableName?.trim() ?? "";
    const assigneeNameField = field(ctx.config, "assigneeNameField", "Name");

    // Respeta el período del reporte: solo records creados/modificados desde
    // `since`. Antes se ignoraba y todos los reportes traían los mismos datos.
    const records = await atFetchAll(baseId, table, ctx.secret, opts?.since);
    const now = Date.now();

    // Resolución dinámica de columnas: mapeo confirmado por el usuario
    // (config.fieldMap) > config legacy por campo > heurística por sinónimos >
    // default. Así la lectura nunca falla porque no exista una columna con un
    // nombre fijo como "Name"/"Assignee"/"Status".
    const fieldMap: FieldMap = parseFieldMap(ctx.config.fieldMap);
    const keys = Array.from(
      new Set(records.flatMap((r) => Object.keys(r.fields ?? {}))),
    );
    const resolveCol = (
      logical: DevMetricsField,
      legacyKey: string | undefined,
      dflt: string,
    ): string => {
      const mapped = fieldMap[logical];
      if (mapped && keys.includes(mapped)) return mapped;
      const legacy = legacyKey ? ctx.config[legacyKey]?.trim() : "";
      if (legacy && keys.includes(legacy)) return legacy;
      const auto = bestColumnByName(logical, keys);
      if (auto) return auto;
      return dflt;
    };

    const statusField = resolveCol("status", "statusField", "Status");
    const assigneeField = resolveCol("assignee", "assigneeField", "Assignee");
    const pointsField = resolveCol("storyPoints", "pointsField", "Story Points");
    const titleField = resolveCol("title", "titleField", "Name");
    const priorityField = resolveCol("priority", undefined, "Priority");

    // Mapea record ids de responsables vinculados a nombres reales (y emails).
    // Automático vía Metadata API (mapa global de la base) con fallback a config.
    const { nameById, emailById, schemaBlocked } = await buildAssigneeNameMap(
      baseId,
      ctx.secret,
      assigneeTable,
      assigneeNameField,
    );

    // Deep link al REGISTRO exacto. Airtable acepta
    // https://airtable.com/{baseId}/{tableId}/{recordId} (o el mínimo
    // {baseId}/{recordId} si no conocemos el tableId). Antes se usaba solo la
    // base, por lo que el link abría un registro cualquiera ("tarea equivocada").
    const schema = await fetchBaseSchema(baseId, ctx.secret);
    const tableId = schema?.find((t) => t.name === table)?.id;
    const recordUrl = (recId: string): string =>
      tableId
        ? `https://airtable.com/${baseId}/${tableId}/${recId}`
        : `https://airtable.com/${baseId}/${recId}`;

    // Directorio nombre → email (el email es la clave universal de identidad).
    const personEmails: { handle: string; email: string }[] = [];
    for (const [recId, email] of emailById) {
      const nm = nameById.get(recId);
      if (nm) personEmails.push({ handle: nm, email });
    }

    const workItems: UnifiedWorkItem[] = records.map((rec) => {
      const f = rec.fields ?? {};
      const status = toStr(f[statusField]) || "To Do";
      const bucket = bucketFor(status);
      const priority = toStr(f[priorityField]) || null;
      const updatedRaw =
        toStr(f["Last Modified"]) ||
        toStr(f["Last modified time"]) ||
        toStr(f["Updated"]) ||
        rec.createdTime;
      const updatedMs = new Date(updatedRaw).getTime();
      const assignees = resolveAssignees(f[assigneeField], nameById);
      const isDone = bucket === "DONE";
      const isStale =
        !isDone &&
        !Number.isNaN(updatedMs) &&
        (now - updatedMs) / (1000 * 60 * 60 * 24) > STALE_DAYS;

      return {
        source: "airtable",
        externalId: toStr(f["ID"]) || rec.id.slice(0, 8),
        title: toStr(f[titleField]) || "(sin título)",
        status,
        bucket,
        assignee: assignees[0] ?? null,
        assignees: assignees.length > 1 ? assignees : undefined,
        priority,
        isCritical: priority ? CRITICAL.test(priority) : false,
        isStale,
        storyPoints: toNum(f[pointsField]),
        labels: [],
        type: null,
        project: table,
        sprint: null,
        url: recordUrl(rec.id),
        createdAt: rec.createdTime,
        updatedAt: updatedRaw,
        resolvedAt: isDone ? updatedRaw : null,
      };
    });

    // Diagnóstico: si el responsable quedó como record id sin resolver y no
    // pudimos leer el esquema, avisamos qué falta (scope o config).
    if (
      schemaBlocked &&
      workItems.some((w) => w.assignee && looksLikeRecordId(w.assignee))
    ) {
      console.warn(
        "[airtable] Hay responsables como record id sin resolver. " +
          "Agregá el scope 'schema.bases:read' al token (o configurá la tabla de personas) " +
          "para mostrar nombres reales.",
      );
    }

    return { workItems, personEmails };
  },
};
