import type {
  ChecksState,
  CiRun,
  CodeChangeState,
  ProviderAdapter,
  UnifiedCodeChange,
} from "../types";
import { demoDataFor, isDemo, periodDaysFrom } from "../demo";
import { safeFetch, assertSafeUrl } from "@/lib/http";

// GitLab adapter — REST v4. Uses a Personal Access Token (read_api) via the
// PRIVATE-TOKEN header. Supports gitlab.com and self-hosted instances.

const OLD_HOURS = 72;

/**
 * Resuelve y valida el baseUrl del usuario (SEC-04 / SSRF). Sólo https:
 * (self-hosted incluido) y se bloquean hosts privados/loopback. Lanza Error si
 * es inseguro; los callers (testConnection/fetchData) capturan y devuelven el
 * resultado de error del provider.
 */
async function safeBaseUrl(config: Record<string, string>): Promise<string> {
  const raw = (config.baseUrl ?? "").trim() || "https://gitlab.com";
  return assertSafeUrl(raw, { allowInsecure: false, blockPrivate: true });
}

function projectPath(config: Record<string, string>): string {
  return encodeURIComponent((config.projectId ?? "").trim());
}

async function glFetch(
  base: string,
  path: string,
  token: string,
): Promise<Response> {
  return safeFetch(`${base}/api/v4${path}`, {
    headers: { "PRIVATE-TOKEN": token },
    cache: "no-store",
  });
}

interface RawMr {
  iid: number;
  title: string;
  state: string; // opened | merged | closed | locked
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  web_url: string;
  draft?: boolean;
  work_in_progress?: boolean;
  author?: { username?: string } | null;
  reviewers?: Array<{ username?: string }>;
  head_pipeline?: { status?: string } | null;
}

function mapPipeline(status: string | undefined): ChecksState {
  if (!status) return "unknown";
  if (status === "success") return "success";
  if (status === "failed" || status === "canceled") return "failure";
  if (["running", "pending", "created", "waiting_for_resource"].includes(status))
    return "pending";
  return "unknown";
}

function mapState(state: string): CodeChangeState {
  if (state === "merged") return "MERGED";
  if (state === "closed" || state === "locked") return "CLOSED";
  return "OPEN";
}

function normalize(mr: RawMr, now: number): UnifiedCodeChange {
  const state = mapState(mr.state);
  const reviewerCount = mr.reviewers?.length ?? 0;
  const ageHours =
    state === "OPEN"
      ? (now - new Date(mr.created_at).getTime()) / (1000 * 60 * 60)
      : 0;
  const isOld = state === "OPEN" && ageHours > OLD_HOURS;
  const checksState = mapPipeline(mr.head_pipeline?.status);
  return {
    source: "gitlab",
    externalId: String(mr.iid),
    title: mr.title,
    author: mr.author?.username ?? null,
    state,
    reviewerCount,
    hasReviewer: reviewerCount > 0,
    checksState,
    draft: mr.draft ?? mr.work_in_progress ?? false,
    ageHours,
    isOld,
    isRisk: state === "OPEN" && (isOld || checksState === "failure"),
    url: mr.web_url,
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    mergedAt: mr.merged_at,
    closedAt: mr.closed_at,
  };
}

export const gitlabAdapter: ProviderAdapter = {
  slug: "gitlab",
  async testConnection(ctx) {
    if (isDemo(ctx.config)) return { ok: true, detail: "Modo demo" };
    try {
      const base = await safeBaseUrl(ctx.config);
      const res = await glFetch(
        base,
        `/projects/${projectPath(ctx.config)}`,
        ctx.secret,
      );
      if (res.status === 401) return { ok: false, error: "Token inválido." };
      if (res.status === 404)
        return {
          ok: false,
          error: "No se encontró el proyecto (revisá ID/path o permisos).",
        };
      if (!res.ok)
        return { ok: false, error: `GitLab respondió ${res.status}.` };
      const project = (await res.json()) as { path_with_namespace?: string };
      return {
        ok: true,
        detail: `Proyecto "${project.path_with_namespace ?? ""}"`,
      };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Error de red con GitLab: ${err.message}`
            : "Error desconocido con GitLab.",
      };
    }
  },

  async fetchData(ctx, opts) {
    if (isDemo(ctx.config)) return demoDataFor("gitlab", periodDaysFrom(opts));
    const base = await safeBaseUrl(ctx.config);
    const proj = projectPath(ctx.config);
    const now = Date.now();
    const since =
      opts?.since ??
      new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    async function list(query: string): Promise<RawMr[]> {
      const res = await glFetch(
        base,
        `/projects/${proj}/merge_requests?${query}`,
        ctx.secret,
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `GitLab devolvió ${res.status} al listar MRs. ${detail.slice(0, 160)}`,
        );
      }
      return (await res.json()) as RawMr[];
    }

    const [opened, merged, closed] = await Promise.all([
      list("state=opened&per_page=100&with_merge_status_recheck=false"),
      list(`state=merged&updated_after=${encodeURIComponent(since)}&per_page=100`),
      list(`state=closed&updated_after=${encodeURIComponent(since)}&per_page=100`),
    ]);

    const codeChanges = [...opened, ...merged, ...closed].map((mr) =>
      normalize(mr, now),
    );

    // Pipelines (CI).
    let ciRuns: CiRun[] = [];
    try {
      const res = await glFetch(
        base,
        `/projects/${proj}/pipelines?updated_after=${encodeURIComponent(since)}&per_page=50`,
        ctx.secret,
      );
      if (res.ok) {
        const pipes = (await res.json()) as {
          id: number;
          status: string;
          ref?: string;
          web_url?: string;
          created_at?: string;
        }[];
        ciRuns = pipes.map((p) => ({
          source: "gitlab" as const,
          externalId: String(p.id),
          name: p.ref ?? "pipeline",
          status:
            p.status === "success"
              ? "success"
              : p.status === "failed"
                ? "failure"
                : ["running", "pending", "created", "waiting_for_resource"].includes(p.status)
                  ? "running"
                  : "other",
          isDeploy: false,
          url: p.web_url ?? "#",
          createdAt: p.created_at ?? null,
        }));
      }
    } catch {
      ciRuns = [];
    }

    return { codeChanges, ciRuns };
  },
};
