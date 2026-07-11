import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, isCriticalPriority, httpError } from "./planning-helpers";

// Azure DevOps Boards (PLANNING). Auth: Basic base64(":"+PAT). WIQL + workitems batch.
function basic(pat: string): string {
  return "Basic " + Buffer.from(`:${pat}`).toString("base64");
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
      const org = ctx.config.organization.replace(/^https?:\/\/dev\.azure\.com\//, "").replace(/\/$/, "");
      const res = await fetch(
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
    const org = ctx.config.organization.replace(/^https?:\/\/dev\.azure\.com\//, "").replace(/\/$/, "");
    const project = ctx.config.project;
    const headers = { Authorization: basic(ctx.secret), "Content-Type": "application/json" };
    const wiql = await fetch(
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
    const batch = await fetch(
      `https://dev.azure.com/${org}/_apis/wit/workitems?ids=${ids.slice(0, 200).join(",")}&api-version=7.0`,
      { headers, cache: "no-store" },
    );
    if (!batch.ok) throw new Error(`Azure DevOps devolvió ${batch.status}.`);
    const items = ((await batch.json()) as { value?: WiField[] }).value ?? [];
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
