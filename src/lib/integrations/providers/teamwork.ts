import { safeFetch, assertSafeUrl } from "@/lib/http";
import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Teamwork (PLANNING). Auth: Basic base64(apiKey + ":xxx"). Host: {site}.
function basic(apiKey: string): string {
  return "Basic " + Buffer.from(`${apiKey}:xxx`).toString("base64");
}
function base(site: string): string {
  const clean = (site ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${clean}`;
}
/** SEC-04 / SSRF: valida el host {site} del usuario y devuelve el base normalizado. */
async function safeBase(site: string): Promise<string> {
  return assertSafeUrl(base(site), { allowInsecure: false, blockPrivate: true });
}

interface RawTask {
  id: number | string;
  content: string;
  completed?: boolean;
  status?: string;
  "responsible-party-names"?: string;
  "last-changed-on"?: string | null;
  "created-on"?: string | null;
}

export const teamworkAdapter: ProviderAdapter = {
  slug: "teamwork",
  async testConnection(ctx) {
    try {
      const site = await safeBase(ctx.config.site);
      const res = await safeFetch(`${site}/me.json`, {
        headers: { Authorization: basic(ctx.secret) },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Teamwork") };
      return { ok: true, detail: "Cuenta conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const site = await safeBase(ctx.config.site);
    const res = await safeFetch(`${site}/tasks.json?pageSize=100`, {
      headers: { Authorization: basic(ctx.secret) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Teamwork devolvió ${res.status}.`);
    const data = (await res.json()) as { "todo-items"?: RawTask[] };
    const workItems = (data["todo-items"] ?? []).map((t) => {
      const done = Boolean(t.completed) || t.status === "completed";
      const status = t.status ?? (done ? "completed" : "active");
      const bucket = planBucket(status, done);
      return mkItem({
        source: "teamwork",
        externalId: String(t.id),
        title: t.content,
        status,
        bucket,
        url: `${site}/#/tasks/${t.id}`,
        assignee: t["responsible-party-names"] || null,
        createdAt: t["created-on"] ?? null,
        updatedAt: t["last-changed-on"] ?? null,
        isStale: isStale(t["last-changed-on"] ?? null, done),
      });
    });
    return { workItems };
  },
};
