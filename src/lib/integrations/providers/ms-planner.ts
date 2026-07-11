import type { ProviderAdapter } from "../types";
import { mkItem, isStale, httpError } from "./planning-helpers";
import type { WorkItemBucket } from "../types";

// Microsoft Planner (PLANNING) via Microsoft Graph. Auth: Bearer access token
// (OAuth). Nota: la app necesitará un flujo OAuth con Microsoft para obtener y
// refrescar el token; hoy se ingresa un access token manualmente.
const GRAPH = "https://graph.microsoft.com/v1.0";

interface RawTask {
  id: string;
  title: string;
  percentComplete: number;
  createdDateTime?: string | null;
  dueDateTime?: string | null;
  assignments?: Record<string, unknown>;
}

function bucketFor(pct: number): WorkItemBucket {
  if (pct >= 100) return "DONE";
  if (pct > 0) return "IN_PROGRESS";
  return "TODO";
}

export const msPlannerAdapter: ProviderAdapter = {
  slug: "ms-planner",
  async testConnection(ctx) {
    try {
      const res = await fetch(`${GRAPH}/me`, {
        headers: { Authorization: `Bearer ${ctx.secret}` },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Microsoft Graph") };
      return { ok: true, detail: "Cuenta Microsoft conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await fetch(`${GRAPH}/planner/plans/${ctx.config.planId}/tasks`, {
      headers: { Authorization: `Bearer ${ctx.secret}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Microsoft Graph devolvió ${res.status}.`);
    const data = (await res.json()) as { value?: RawTask[] };
    const workItems = (data.value ?? []).map((t) => {
      const bucket = bucketFor(t.percentComplete ?? 0);
      const assigneeCount = t.assignments ? Object.keys(t.assignments).length : 0;
      return mkItem({
        source: "ms-planner",
        externalId: t.id,
        title: t.title,
        status: `${t.percentComplete ?? 0}%`,
        bucket,
        url: `https://tasks.office.com/`,
        assignee: assigneeCount > 0 ? `${assigneeCount} asignado(s)` : null,
        createdAt: t.createdDateTime ?? null,
        isStale: false,
      });
    });
    return { workItems };
  },
};
