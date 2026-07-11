import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, isCriticalPriority, httpError } from "./planning-helpers";

// Shortcut (PLANNING). Auth: header Shortcut-Token.
const API = "https://api.app.shortcut.com/api/v3";

interface RawStory {
  id: number;
  name: string;
  app_url: string;
  completed: boolean;
  started: boolean;
  archived?: boolean;
  updated_at?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  estimate?: number | null;
  owner_ids?: string[];
}

export const shortcutAdapter: ProviderAdapter = {
  slug: "shortcut",
  async testConnection(ctx) {
    try {
      const res = await fetch(`${API}/member`, {
        headers: { "Shortcut-Token": ctx.secret },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Shortcut") };
      return { ok: true, detail: "Cuenta conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await fetch(`${API}/search/stories?query=${encodeURIComponent("!is:archived")}&page_size=25`, {
      headers: { "Shortcut-Token": ctx.secret },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Shortcut devolvió ${res.status}.`);
    const data = (await res.json()) as { data?: RawStory[] };
    const workItems = (data.data ?? []).map((s) => {
      const status = s.completed ? "Completed" : s.started ? "Started" : "Unstarted";
      const bucket = planBucket(status, s.completed);
      return mkItem({
        source: "shortcut",
        externalId: String(s.id),
        title: s.name,
        status,
        bucket,
        url: s.app_url,
        storyPoints: typeof s.estimate === "number" ? s.estimate : null,
        createdAt: s.created_at ?? null,
        updatedAt: s.updated_at ?? null,
        resolvedAt: s.completed_at ?? null,
        isStale: isStale(s.updated_at ?? null, s.completed),
      });
    });
    return { workItems };
  },
};
