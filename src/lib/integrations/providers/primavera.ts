import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Oracle Primavera P6 (PLANNING) — ENTERPRISE / best-effort.
// P6 EPPM REST API sobre {baseUrl}/p6ws/restapi. Auth: Bearer (algunas
// instalaciones usan Basic/cookie). Endpoints y forma de respuesta pueden variar
// por versión; validar contra la instancia real.
interface RawActivity {
  ObjectId: number | string;
  Name?: string;
  Status?: string;
  PercentComplete?: number;
  LastUpdateDate?: string | null;
  StartDate?: string | null;
  FinishDate?: string | null;
}

export const primaveraAdapter: ProviderAdapter = {
  slug: "primavera",
  async testConnection(ctx) {
    try {
      const url = `${ctx.config.baseUrl.replace(/\/$/, "")}/p6ws/restapi/project?Fields=ObjectId`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${ctx.secret}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Primavera P6") };
      return { ok: true, detail: "P6 conectado" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const url = `${ctx.config.baseUrl.replace(/\/$/, "")}/p6ws/restapi/activity?Fields=ObjectId,Name,Status,PercentComplete,LastUpdateDate,StartDate,FinishDate`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ctx.secret}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Primavera P6 devolvió ${res.status}.`);
    const list = (await res.json()) as RawActivity[];
    const workItems = (Array.isArray(list) ? list : []).map((a) => {
      const status = a.Status ?? "";
      const done = /completed/i.test(status) || (a.PercentComplete ?? 0) >= 100;
      const bucket = planBucket(status, done);
      return mkItem({
        source: "primavera",
        externalId: String(a.ObjectId),
        title: a.Name ?? `Activity ${a.ObjectId}`,
        status: status || "Activity",
        bucket,
        url: ctx.config.baseUrl,
        createdAt: a.StartDate ?? null,
        updatedAt: a.LastUpdateDate ?? null,
        resolvedAt: done ? a.FinishDate ?? null : null,
        isStale: isStale(a.LastUpdateDate ?? null, done),
      });
    });
    return { workItems };
  },
};
