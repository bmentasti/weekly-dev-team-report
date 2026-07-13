import { safeFetch, assertSafeUrl } from "@/lib/http";
import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Microsoft Project (PLANNING) — best-effort vía Project Online Reporting OData
// ({siteUrl}/_api/ProjectData). Auth: Bearer. Requiere Project Online; Project
// for the web usa Dataverse/Graph y necesitaría otro adapter. Validar con datos
// reales; endpoints pueden requerir ajuste.
interface RawTask {
  TaskId: string;
  TaskName: string;
  TaskPercentCompleted?: number;
  ProjectName?: string;
  TaskModifiedDate?: string | null;
  TaskCreatedDate?: string | null;
  TaskFinishDate?: string | null;
}

export const msProjectAdapter: ProviderAdapter = {
  slug: "ms-project",
  async testConnection(ctx) {
    try {
      // SEC-04 / SSRF: validar el siteUrl provisto por el usuario (https + no privado).
      const site = await assertSafeUrl(ctx.config.siteUrl, {
        allowInsecure: false,
        blockPrivate: true,
      });
      const url = `${site}/_api/ProjectData/Projects?$top=1`;
      const res = await safeFetch(url, {
        headers: { Authorization: `Bearer ${ctx.secret}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Project Online") };
      return { ok: true, detail: "Project Online conectado" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const site = await assertSafeUrl(ctx.config.siteUrl, {
      allowInsecure: false,
      blockPrivate: true,
    });
    const url = `${site}/_api/ProjectData/Tasks?$top=100&$orderby=TaskModifiedDate desc`;
    const res = await safeFetch(url, {
      headers: { Authorization: `Bearer ${ctx.secret}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Project Online devolvió ${res.status}.`);
    const data = (await res.json()) as { value?: RawTask[]; d?: { results?: RawTask[] } };
    const list = data.value ?? data.d?.results ?? [];
    const workItems = list.map((t) => {
      const pct = t.TaskPercentCompleted ?? 0;
      const done = pct >= 100;
      const status = `${pct}%`;
      const bucket = planBucket("", done) === "DONE" ? "DONE" : pct > 0 ? "IN_PROGRESS" : "TODO";
      return mkItem({
        source: "ms-project",
        externalId: String(t.TaskId),
        title: t.TaskName,
        status,
        bucket,
        url: ctx.config.siteUrl,
        project: t.ProjectName ?? null,
        createdAt: t.TaskCreatedDate ?? null,
        updatedAt: t.TaskModifiedDate ?? null,
        resolvedAt: done ? t.TaskFinishDate ?? null : null,
        isStale: isStale(t.TaskModifiedDate ?? null, done),
      });
    });
    return { workItems };
  },
};
