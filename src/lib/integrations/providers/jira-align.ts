import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Jira Align (PLANNING) — ENTERPRISE / best-effort.
// Auth: Bearer API token. Endpoints según Jira Align REST API v2; pueden variar
// por instancia/versión y requerir ajuste al validarse con credenciales reales.
interface RawWorkItem {
  id: number | string;
  title?: string;
  state?: string;
  itemType?: string;
  lastUpdatedDate?: string | null;
  createDate?: string | null;
}

export const jiraAlignAdapter: ProviderAdapter = {
  slug: "jira-align",
  async testConnection(ctx) {
    try {
      const res = await fetch(
        `https://${ctx.config.instance}/rest/align/api/2/WorkItems?$top=1`,
        {
          headers: { Authorization: `Bearer ${ctx.secret}`, Accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!res.ok) return { ok: false, error: httpError(res.status, "Jira Align") };
      return { ok: true, detail: "Instancia conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await fetch(
      `https://${ctx.config.instance}/rest/align/api/2/WorkItems?$top=100`,
      {
        headers: { Authorization: `Bearer ${ctx.secret}`, Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Jira Align devolvió ${res.status}.`);
    const raw = (await res.json()) as RawWorkItem[] | { value?: RawWorkItem[] };
    const list = Array.isArray(raw) ? raw : raw.value ?? [];
    const workItems = list.map((w) => {
      const status = w.state ?? "";
      const bucket = planBucket(status);
      return mkItem({
        source: "jira-align",
        externalId: String(w.id),
        title: w.title ?? `Work item ${w.id}`,
        status: status || "Unknown",
        bucket,
        url: `https://${ctx.config.instance}/WorkItem/${w.id}`,
        type: w.itemType ?? null,
        createdAt: w.createDate ?? null,
        updatedAt: w.lastUpdatedDate ?? null,
        isStale: isStale(w.lastUpdatedDate ?? null, bucket === "DONE"),
      });
    });
    return { workItems };
  },
};
