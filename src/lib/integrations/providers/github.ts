import { fetchWithRetry, assertOk } from "@/lib/http";
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

// Tope de páginas para acotar tiempo/rate-limit (100/página → hasta 500 runs).
const MAX_CI_PAGES = 5;

/**
 * Trae las corridas de CI/CD paginando, con reintentos y backoff. A diferencia
 * de antes, NO se traga los errores: si falla de verdad (tras reintentos) lanza,
 * para que el estado de la integración lo refleje en vez de mostrar 0 builds
 * como si estuviera todo bien.
 */
async function fetchGitHubCi(
  cfg: GitHubConnectionConfig,
  token: string,
  since?: string,
): Promise<CiRun[]> {
  const sinceMs = since ? new Date(since).getTime() : 0;
  const out: CiRun[] = [];
  for (let page = 1; page <= MAX_CI_PAGES; page++) {
    const params = new URLSearchParams({ per_page: "100", page: String(page) });
    if (since) params.set("created", `>=${since.slice(0, 10)}`);
    const res = await fetchWithRetry(
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
    await assertOk(res, `GitHub (CI ${cfg.owner}/${cfg.repo})`);
    const data = (await res.json()) as { workflow_runs?: RawRun[] };
    const batch = data.workflow_runs ?? [];
    for (const r of batch) {
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
      out.push({
        source: "github" as const,
        externalId: String(r.id),
        name,
        status,
        isDeploy: /deploy|release|\bcd\b|prod/i.test(name),
        url: r.html_url ?? "#",
        createdAt: r.created_at ?? null,
      });
    }
    if (batch.length < 100) break;
    // Vienen ordenadas por fecha desc: si la última ya es anterior al período,
    // las páginas siguientes tampoco entran.
    const oldest = batch[batch.length - 1]?.created_at;
    if (sinceMs && oldest && new Date(oldest).getTime() < sinceMs) break;
  }
  return out;
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
    // Los PRs son la señal crítica: si fallan, propagamos el error (la
    // integración queda en un estado accionable). El CI es secundario: si falla,
    // NO tiramos abajo los PRs; lo reportamos como warning → PARTIALLY_SYNCED.
    const prs = await fetchPullRequests(cfg, ctx.secret, { since: opts?.since });
    const warnings: string[] = [];
    let ciRuns: CiRun[] = [];
    try {
      ciRuns = await fetchGitHubCi(cfg, ctx.secret, opts?.since);
    } catch (err) {
      warnings.push(
        `No se pudieron traer los datos de CI/CD de ${cfg.owner}/${cfg.repo}: ${
          err instanceof Error ? err.message : "error desconocido"
        }`,
      );
    }
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
    return { codeChanges, ciRuns, warnings: warnings.length ? warnings : undefined };
  },
};
