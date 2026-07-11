import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, isCriticalPriority, httpError } from "./planning-helpers";

// Jira Advanced Roadmaps (PLANNING). Advanced Roadmaps no expone una API pública
// limpia de "planes"; la fuente de verdad son los issues de Jira que el plan
// agrupa. Reutilizamos Jira Cloud (Basic email:token) filtrando por proyecto.
function basic(email: string, token: string): string {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status?: { name?: string; statusCategory?: { key?: string } };
    assignee?: { displayName?: string } | null;
    priority?: { name?: string } | null;
    created?: string;
    updated?: string;
    resolutiondate?: string | null;
    issuetype?: { name?: string };
  };
}

export const jiraRoadmapsAdapter: ProviderAdapter = {
  slug: "jira-roadmaps",
  async testConnection(ctx) {
    try {
      const res = await fetch(`https://${ctx.config.domain}/rest/api/3/myself`, {
        headers: { Authorization: basic(ctx.config.email, ctx.secret) },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Jira") };
      return { ok: true, detail: "Jira conectado" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const jql = ctx.config.projectKey
      ? encodeURIComponent(`project = ${ctx.config.projectKey} ORDER BY updated DESC`)
      : encodeURIComponent("ORDER BY updated DESC");
    const res = await fetch(
      `https://${ctx.config.domain}/rest/api/3/search?jql=${jql}&maxResults=100&fields=summary,status,assignee,priority,created,updated,resolutiondate,issuetype`,
      {
        headers: { Authorization: basic(ctx.config.email, ctx.secret) },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Jira devolvió ${res.status}.`);
    const data = (await res.json()) as { issues?: JiraIssue[] };
    const workItems = (data.issues ?? []).map((i) => {
      const status = i.fields.status?.name ?? "";
      const done = i.fields.status?.statusCategory?.key === "done";
      const bucket = planBucket(status, done);
      const priority = i.fields.priority?.name ?? null;
      return mkItem({
        source: "jira-roadmaps",
        externalId: i.key,
        title: i.fields.summary,
        status: status || "To Do",
        bucket,
        url: `https://${ctx.config.domain}/browse/${i.key}`,
        assignee: i.fields.assignee?.displayName ?? null,
        priority,
        isCritical: isCriticalPriority(priority),
        type: i.fields.issuetype?.name ?? null,
        createdAt: i.fields.created ?? null,
        updatedAt: i.fields.updated ?? null,
        resolvedAt: i.fields.resolutiondate ?? null,
        isStale: isStale(i.fields.updated ?? null, done),
      });
    });
    return { workItems };
  },
};
