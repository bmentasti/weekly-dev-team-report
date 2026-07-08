import type {
  ProviderAdapter,
  UnifiedWorkItem,
  WorkItemBucket,
} from "../types";

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
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
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
      return { ok: true, detail: `Tabla "${table}"` };
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

  async fetchData(ctx) {
    const baseId = ctx.config.baseId?.trim() ?? "";
    const table = ctx.config.tableName?.trim() ?? "";
    const statusField = field(ctx.config, "statusField", "Status");
    const assigneeField = field(ctx.config, "assigneeField", "Assignee");
    const pointsField = field(ctx.config, "pointsField", "Story Points");
    const titleField = field(ctx.config, "titleField", "Name");

    const res = await atFetch(baseId, table, ctx.secret, "?maxRecords=100");
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Airtable devolvió ${res.status}. ${detail.slice(0, 160)}`,
      );
    }
    const data = (await res.json()) as { records?: RawRecord[] };
    const now = Date.now();

    const workItems: UnifiedWorkItem[] = (data.records ?? []).map((rec) => {
      const f = rec.fields ?? {};
      const status = toStr(f[statusField]) || "To Do";
      const bucket = bucketFor(status);
      const priority = toStr(f["Priority"]) || null;
      const updatedRaw =
        toStr(f["Last Modified"]) ||
        toStr(f["Last modified time"]) ||
        toStr(f["Updated"]) ||
        rec.createdTime;
      const updatedMs = new Date(updatedRaw).getTime();
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
        assignee: toStr(f[assigneeField]) || null,
        priority,
        isCritical: priority ? CRITICAL.test(priority) : false,
        isStale,
        storyPoints: toNum(f[pointsField]),
        labels: [],
        type: null,
        project: table,
        sprint: null,
        url: `https://airtable.com/${baseId}`,
        createdAt: rec.createdTime,
        updatedAt: updatedRaw,
        resolvedAt: isDone ? updatedRaw : null,
      };
    });

    return { workItems };
  },
};
