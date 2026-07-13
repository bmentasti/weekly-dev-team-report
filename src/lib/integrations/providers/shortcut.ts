import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, testJson, fetchJson } from "./planning-helpers";

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
    return testJson(
      `${API}/member`,
      { "Shortcut-Token": ctx.secret },
      "Shortcut",
    );
  },
  async fetchData(ctx) {
    const data = await fetchJson<{ data?: RawStory[] }>(
      `${API}/search/stories?query=${encodeURIComponent("!is:archived")}&page_size=25`,
      { "Shortcut-Token": ctx.secret },
      "Shortcut",
    );
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
