import type { ProviderAdapter, UnifiedWorkItem } from "../types";
import {
  fetchProjectIssues,
  normalizeDomain,
  testJiraConnection,
} from "@/lib/jira/service";
import type { JiraConnectionConfig } from "@/lib/jira/types";
import { demoDataFor, isDemo, periodDaysFrom } from "../demo";

function toConfig(config: Record<string, string>): JiraConnectionConfig {
  return {
    domain: normalizeDomain(config.domain ?? ""),
    email: config.email ?? "",
    projectKey: config.projectKey ?? "",
  };
}

export const jiraAdapter: ProviderAdapter = {
  slug: "jira",
  async testConnection(ctx) {
    if (isDemo(ctx.config)) return { ok: true, detail: "Modo demo" };
    const r = await testJiraConnection(toConfig(ctx.config), ctx.secret);
    return {
      ok: r.ok,
      error: r.error,
      detail: r.ok
        ? `Proyecto "${r.projectName ?? ""}" (cuenta: ${r.accountDisplayName ?? "?"})`
        : undefined,
    };
  },
  async fetchData(ctx, opts) {
    if (isDemo(ctx.config)) return demoDataFor("jira", periodDaysFrom(opts));
    const cfg = toConfig(ctx.config);
    const issues = await fetchProjectIssues(cfg, ctx.secret, {
      updatedSince: opts?.since,
    });
    const workItems: UnifiedWorkItem[] = issues.map((i) => ({
      source: "jira",
      externalId: i.key,
      title: i.summary,
      status: i.status,
      bucket: i.bucket,
      assignee: i.assignee,
      priority: i.priority,
      isCritical: i.isCritical,
      isStale: i.isStale,
      storyPoints: i.storyPoints,
      labels: i.labels,
      type: i.issueType,
      project: cfg.projectKey,
      sprint: i.sprint,
      url: i.url,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      resolvedAt: i.resolvedAt,
    }));
    return { workItems };
  },
};
