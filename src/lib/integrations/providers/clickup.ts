import type {
  ProviderAdapter,
  UnifiedWorkItem,
  WorkItemBucket,
} from "../types";

// ClickUp adapter (ISSUES). Auth: Authorization: <apiToken> (sin Bearer).

const API = "https://api.clickup.com/api/v2";
const STALE_DAYS = 5;
const CRITICAL = new Set(["urgent", "high"]);

interface RawTask {
  id: string;
  name: string;
  url: string;
  status?: { status?: string; type?: string };
  assignees?: { username?: string }[];
  priority?: { priority?: string } | null;
  date_created?: string;
  date_updated?: string;
  points?: number | null;
}

function bucketFor(type: string | undefined, status: string): WorkItemBucket {
  if (/block|bloque/i.test(status)) return "BLOCKED";
  if (type === "closed" || type === "done") return "DONE";
  if (type === "custom" || /progress|doing|curso/i.test(status))
    return "IN_PROGRESS";
  return "TODO";
}

export const clickupAdapter: ProviderAdapter = {
  slug: "clickup",
  async testConnection(ctx) {
    try {
      const res = await fetch(`${API}/list/${ctx.config.listId}`, {
        headers: { Authorization: ctx.secret },
        cache: "no-store",
      });
      if (res.status === 401) return { ok: false, error: "API token inválido." };
      if (res.status === 404) return { ok: false, error: "No se encontró la lista." };
      if (!res.ok) return { ok: false, error: `ClickUp respondió ${res.status}.` };
      return { ok: true, detail: "Lista conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await fetch(`${API}/list/${ctx.config.listId}/task`, {
      headers: { Authorization: ctx.secret },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ClickUp devolvió ${res.status}.`);
    const data = (await res.json()) as { tasks?: RawTask[] };
    const now = Date.now();

    const workItems: UnifiedWorkItem[] = (data.tasks ?? []).map((t) => {
      const status = t.status?.status ?? "";
      const bucket = bucketFor(t.status?.type, status);
      const priority = t.priority?.priority ?? null;
      const updatedMs = t.date_updated ? Number(t.date_updated) : now;
      const isDone = bucket === "DONE";
      return {
        source: "clickup",
        externalId: t.id,
        title: t.name,
        status: status || "To Do",
        bucket,
        assignee: t.assignees?.[0]?.username ?? null,
        priority,
        isCritical: priority ? CRITICAL.has(priority.toLowerCase()) : false,
        isStale: !isDone && (now - updatedMs) / (1000 * 60 * 60 * 24) > STALE_DAYS,
        storyPoints: typeof t.points === "number" ? t.points : null,
        labels: [],
        type: null,
        project: null,
        sprint: null,
        url: t.url,
        createdAt: t.date_created
          ? new Date(Number(t.date_created)).toISOString()
          : null,
        updatedAt: t.date_updated
          ? new Date(Number(t.date_updated)).toISOString()
          : null,
        resolvedAt: null,
      };
    });
    return { workItems };
  },
};
