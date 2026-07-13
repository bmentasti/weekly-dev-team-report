import { safeFetch } from "@/lib/http";
import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Basecamp 3 (PLANNING). Auth: Bearer (OAuth). base: https://3.basecampapi.com/{accountId}.
interface RawTodo {
  id: number;
  content: string;
  completed: boolean;
  app_url: string;
  updated_at?: string | null;
  created_at?: string | null;
  assignees?: { name?: string }[];
}

function base(accountId: string): string {
  return `https://3.basecampapi.com/${accountId}`;
}

export const basecampAdapter: ProviderAdapter = {
  slug: "basecamp",
  async testConnection(ctx) {
    try {
      const res = await safeFetch(
        `${base(ctx.config.accountId)}/projects/${ctx.config.projectId}.json`,
        {
          headers: {
            Authorization: `Bearer ${ctx.secret}`,
            "User-Agent": "DevMetrics (support@devmetrics.app)",
          },
          cache: "no-store",
        },
      );
      if (!res.ok) return { ok: false, error: httpError(res.status, "Basecamp") };
      return { ok: true, detail: "Proyecto conectado" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await safeFetch(
      `${base(ctx.config.accountId)}/buckets/${ctx.config.projectId}/todolists/${ctx.config.todolistId}/todos.json`,
      {
        headers: {
          Authorization: `Bearer ${ctx.secret}`,
          "User-Agent": "DevMetrics (support@devmetrics.app)",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Basecamp devolvió ${res.status}.`);
    const todos = (await res.json()) as RawTodo[];
    const workItems = todos.map((t) => {
      const bucket = planBucket("", t.completed);
      return mkItem({
        source: "basecamp",
        externalId: String(t.id),
        title: t.content,
        status: t.completed ? "completed" : "open",
        bucket,
        url: t.app_url,
        assignee: t.assignees?.[0]?.name ?? null,
        createdAt: t.created_at ?? null,
        updatedAt: t.updated_at ?? null,
        isStale: isStale(t.updated_at ?? null, t.completed),
      });
    });
    return { workItems };
  },
};
