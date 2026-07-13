import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, testJson, fetchJson } from "./planning-helpers";

// Wrike (PLANNING). Auth: Bearer (permanent token). Host puede variar por datacenter.
const API = "https://www.wrike.com/api/v4";

interface RawTask {
  id: string;
  title: string;
  status: string; // Active, Completed, Deferred, Cancelled
  permalink: string;
  importance?: string; // High, Normal, Low
  updatedDate?: string | null;
  createdDate?: string | null;
  completedDate?: string | null;
  responsibleIds?: string[];
}

export const wrikeAdapter: ProviderAdapter = {
  slug: "wrike",
  async testConnection(ctx) {
    return testJson(
      `${API}/contacts?me=true`,
      { Authorization: `Bearer ${ctx.secret}` },
      "Wrike",
    );
  },
  async fetchData(ctx) {
    const data = await fetchJson<{ data?: RawTask[] }>(
      `${API}/tasks?fields=[%22status%22,%22importance%22,%22dates%22]&pageSize=100`,
      { Authorization: `Bearer ${ctx.secret}` },
      "Wrike",
    );
    const workItems = (data.data ?? []).map((t) => {
      const done = t.status === "Completed";
      const bucket = planBucket(t.status, done);
      return mkItem({
        source: "wrike",
        externalId: t.id,
        title: t.title,
        status: t.status,
        bucket,
        url: t.permalink,
        priority: t.importance ?? null,
        isCritical: t.importance === "High",
        createdAt: t.createdDate ?? null,
        updatedAt: t.updatedDate ?? null,
        resolvedAt: t.completedDate ?? null,
        isStale: isStale(t.updatedDate ?? null, done),
      });
    });
    return { workItems };
  },
};
