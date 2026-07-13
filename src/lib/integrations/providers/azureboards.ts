import { safeFetch, assertSafeUrl } from "@/lib/http";
import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, isCriticalPriority, httpError } from "./planning-helpers";

// Azure DevOps Boards (PLANNING). Auth: Basic base64(":"+PAT). WIQL + workitems batch.
function basic(pat: string): string {
  return "Basic " + Buffer.from(`:${pat}`).toString("base64");
}

// Máximo de IDs que la API de workitems batch acepta por request.
const WORKITEM_BATCH = 200;

function orgSlug(config: Record<string, string>): string {
  return (config.organization ?? "")
    .replace(/^https?:\/\/dev\.azure\.com\//, "")
    .replace(/\/$/, "");
}

/**
 * SEC-04 / SSRF: aunque el host base es fijo (dev.azure.com), validamos la URL
 * resultante construida a partir del `organization` del usuario para bloquear
 * esquemas/hosts inesperados. Lanza si es insegura.
 */
async function assertOrg(org: string): Promise<void> {
  await assertSafeUrl(`https://dev.azure.com/${org}`, {
    allowInsecure: false,
    blockPrivate: true,
  });
}

interface WiqlResp {
  workItems?: { id: number }[];
}
interface WiField {
  id: number;
  fields: Record<string, unknown>;
  _links?: { html?: { href?: string } };
}

export const azureBoardsAdapter: ProviderAdapter = {
  slug: "azure-boards",
  async testConnection(ctx) {
    try {
      const org = orgSlug(ctx.config);
      await assertOrg(org);
      const res = await safeFetch(
        `https://dev.azure.com/${org}/_apis/projects?api-version=7.0`,
        { headers: { Authorization: basic(ctx.secret) }, cache: "no-store" },
      );
      if (!res.ok) return { ok: false, error: httpError(res.status, "Azure DevOps") };
      return { ok: true, detail: "Organización conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const org = orgSlug(ctx.config);
    await assertOrg(org);
    const project = ctx.config.project;
    const headers = { Authorization: basic(ctx.secret), "Content-Type": "application/json" };
    const wiql = await safeFetch(
      `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0&$top=100`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          query:
            "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project ORDER BY [System.ChangedDate] DESC",
        }),
        cache: "no-store",
      },
    );
    if (!wiql.ok) throw new Error(`Azure DevOps devolvió ${wiql.status}.`);
    const ids = ((await wiql.json()) as WiqlResp).workItems?.map((w) => w.id) ?? [];
    if (ids.length === 0) return { workItems: [] };
    // B2: la API de workitems batch acepta hasta WORKITEM_BATCH (200) IDs por
    // request. Antes se truncaba silenciosamente a los primeros 200; ahora
    // paginamos en lotes de 200 (best-effort) para no perder work items.
    const items: WiField[] = [];
    for (let i = 0; i < ids.length; i += WORKITEM_BATCH) {
      const chunk = ids.slice(i, i + WORKITEM_BATCH);
      const batch = await safeFetch(
        `https://dev.azure.com/${org}/_apis/wit/workitems?ids=${chunk.join(",")}&api-version=7.0`,
        { headers, cache: "no-store" },
      );
      if (!batch.ok) throw new Error(`Azure DevOps devolvió ${batch.status}.`);
      const value = ((await batch.json()) as { value?: WiField[] }).value ?? [];
      items.push(...value);
    }
    const workItems = items.map((w) => {
      const f = w.fields;
      const status = String(f["System.State"] ?? "");
      const done = /done|closed|resolved|completed/i.test(status);
      const bucket = planBucket(status, done);
      const priority = f["Microsoft.VSTS.Common.Priority"];
      const changed = (f["System.ChangedDate"] as string) ?? null;
      return mkItem({
        source: "azure-boards",
        externalId: String(w.id),
        title: String(f["System.Title"] ?? `#${w.id}`),
        status: status || "New",
        bucket,
        url: w._links?.html?.href ?? `https://dev.azure.com/${org}/${project}/_workitems/edit/${w.id}`,
        assignee:
          (f["System.AssignedTo"] as { displayName?: string } | undefined)?.displayName ?? null,
        type: String(f["System.WorkItemType"] ?? "") || null,
        priority: priority != null ? String(priority) : null,
        isCritical: priority === 1,
        createdAt: (f["System.CreatedDate"] as string) ?? null,
        updatedAt: changed,
        isStale: isStale(changed, done),
      });
    });
    return { workItems };
  },
};
