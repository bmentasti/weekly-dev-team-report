import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

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
    try {
      const res = await fetch(`${API}/contacts?me=true`, {
        headers: { Authorization: `Bearer ${ctx.secret}` },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Wrike") };
      return { ok: true, detail: "Cuenta conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await fetch(
      `${API}/tasks?fields=[%22status%22,%22importance%22,%22dates%22]&pageSize=100`,
      {
        headers: { Authorization: `Bearer ${ctx.secret}` },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Wrike devolvió ${res.status}.`);
    const data = (await res.json()) as { data?: RawTask[] };
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
