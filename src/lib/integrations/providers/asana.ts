import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, testJson, fetchJson } from "./planning-helpers";

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
    return testJson(
      `${API}/users/me`,
      { Authorization: `Bearer ${ctx.secret}` },
      "Asana",
    );
  },
  async fetchData(ctx) {
    const fields = "name,completed,permalink_url,assignee.name,modified_at,created_at,completed_at";
    const data = await fetchJson<{ data?: RawTask[] }>(
      `${API}/tasks?project=${ctx.config.projectGid}&opt_fields=${fields}&limit=100`,
      { Authorization: `Bearer ${ctx.secret}` },
      "Asana",
    );
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
