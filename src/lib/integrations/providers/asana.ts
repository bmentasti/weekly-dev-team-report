import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Asana (PLANNING). Auth: Bearer PAT.
const API = "https://app.asana.com/api/1.0";

interface RawTask {
  gid: string;
  name: string;
  completed: boolean;
  permalink_url?: string;
  assignee?: { name?: string } | null;
  modified_at?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
}

export const asanaAdapter: ProviderAdapter = {
  slug: "asana",
  async testConnection(ctx) {
    try {
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${ctx.secret}` },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Asana") };
      return { ok: true, detail: "Cuenta conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const fields = "name,completed,permalink_url,assignee.name,modified_at,created_at,completed_at";
    const res = await fetch(
      `${API}/tasks?project=${ctx.config.projectGid}&opt_fields=${fields}&limit=100`,
      {
        headers: { Authorization: `Bearer ${ctx.secret}` },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Asana devolvió ${res.status}.`);
    const data = (await res.json()) as { data?: RawTask[] };
    const workItems = (data.data ?? []).map((t) => {
      const bucket = planBucket("", t.completed);
      return mkItem({
        source: "asana",
        externalId: t.gid,
        title: t.name,
        status: t.completed ? "Completed" : "In progress",
        bucket,
        url: t.permalink_url ?? `https://app.asana.com/0/0/${t.gid}`,
        assignee: t.assignee?.name ?? null,
        createdAt: t.created_at ?? null,
        updatedAt: t.modified_at ?? null,
        resolvedAt: t.completed_at ?? null,
        isStale: isStale(t.modified_at ?? null, t.completed),
      });
    });
    return { workItems };
  },
};
