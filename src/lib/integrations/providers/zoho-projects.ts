import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Zoho Projects (PLANNING). Auth: Authorization: Zoho-oauthtoken <token>.
const API = "https://projectsapi.zoho.com/restapi";

interface RawTask {
  id: number | string;
  name: string;
  status?: { name?: string; type?: string };
  link?: { self?: { url?: string } };
  last_updated_time?: string | null;
  created_date?: string | null;
  priority?: string | null;
  "details"?: { owners?: { name?: string }[] };
}

function auth(token: string) {
  return { Authorization: `Zoho-oauthtoken ${token}` };
}

export const zohoProjectsAdapter: ProviderAdapter = {
  slug: "zoho-projects",
  async testConnection(ctx) {
    try {
      const res = await fetch(
        `${API}/portal/${ctx.config.portalId}/projects/${ctx.config.projectId}/`,
        { headers: auth(ctx.secret), cache: "no-store" },
      );
      if (!res.ok) return { ok: false, error: httpError(res.status, "Zoho") };
      return { ok: true, detail: "Proyecto conectado" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await fetch(
      `${API}/portal/${ctx.config.portalId}/projects/${ctx.config.projectId}/tasks/`,
      { headers: auth(ctx.secret), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Zoho devolvió ${res.status}.`);
    const data = (await res.json()) as { tasks?: RawTask[] };
    const workItems = (data.tasks ?? []).map((t) => {
      const status = t.status?.name ?? "";
      const done = (t.status?.type ?? "").toLowerCase() === "closed";
      const bucket = planBucket(status, done);
      return mkItem({
        source: "zoho-projects",
        externalId: String(t.id),
        title: t.name,
        status: status || "Task",
        bucket,
        url: t.link?.self?.url ?? "https://projects.zoho.com",
        assignee: t.details?.owners?.[0]?.name ?? null,
        priority: t.priority ?? null,
        createdAt: t.created_date ?? null,
        updatedAt: t.last_updated_time ?? null,
        isStale: isStale(t.last_updated_time ?? null, done),
      });
    });
    return { workItems };
  },
};
