import type { CiRun, ProviderAdapter, UnifiedCodeChange } from "../types";
import { fetchPullRequests, testGitHubConnection } from "@/lib/github/service";
import type { GitHubConnectionConfig } from "@/lib/github/types";
import { demoDataFor, isDemo, periodDaysFrom } from "../demo";

function toConfig(config: Record<string, string>): GitHubConnectionConfig {
  return { owner: config.owner ?? "", repo: config.repo ?? "" };
}

interface RawRun {
  id: number;
  name?: string;
  display_title?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  created_at?: string;
}

async function fetchGitHubCi(
  cfg: GitHubConnectionConfig,
  token: string,
  since?: string,
): Promise<CiRun[]> {
  const params = new URLSearchParams({ per_page: "50" });
  if (since) params.set("created", `>=${since.slice(0, 10)}`);
  try {
    const res = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/actions/runs?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { workflow_runs?: RawRun[] };
    return (data.workflow_runs ?? []).map((r) => {
      const name = r.name ?? r.display_title ?? "workflow";
      const conclusion = r.conclusion;
      const status =
        r.status !== "completed"
          ? "running"
          : conclusion === "success"
            ? "success"
            : conclusion === "failure" ||
                conclusion === "timed_out" ||
                conclusion === "startup_failure" ||
                conclusion === "cancelled"
              ? "failure"
              : "other";
      return {
        source: "github" as const,
        externalId: String(r.id),
        name,
        status,
        isDeploy: /deploy|release|\bcd\b|prod/i.test(name),
        url: r.html_url ?? "#",
        createdAt: r.created_at ?? null,
      };
    });
  } catch {
    return [];
  }
}

export const githubAdapter: ProviderAdapter = {
  slug: "github",
  async testConnection(ctx) {
    if (isDemo(ctx.config)) return { ok: true, detail: "Modo demo" };
    const r = await testGitHubConnection(toConfig(ctx.config), ctx.secret);
    return {
      ok: r.ok,
      error: r.error,
      detail: r.ok
        ? `Repositorio "${r.repoFullName ?? ""}"${r.isPrivate ? " (privado)" : ""}`
        : undefined,
    };
  },
  async fetchData(ctx, opts) {
    if (isDemo(ctx.config)) return demoDataFor("github", periodDaysFrom(opts));
    const cfg = toConfig(ctx.config);
    const [prs, ciRuns] = await Promise.all([
      fetchPullRequests(cfg, ctx.secret, { since: opts?.since }),
      fetchGitHubCi(cfg, ctx.secret, opts?.since),
    ]);
    const codeChanges: UnifiedCodeChange[] = prs.map((p) => ({
      source: "github",
      externalId: String(p.number),
      title: p.title,
      author: p.author,
      state: p.state,
      reviewerCount: p.reviewerCount,
      hasReviewer: p.hasReviewer,
      checksState: p.checksState,
      draft: p.draft,
      ageHours: p.ageHours,
      isOld: p.isOld,
      isRisk: p.isRisk,
      url: p.url,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      mergedAt: p.mergedAt,
      closedAt: p.closedAt,
    }));
    return { codeChanges, ciRuns };
  },
};
