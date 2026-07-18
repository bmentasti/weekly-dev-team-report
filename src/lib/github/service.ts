import { fetchWithRetry } from "@/lib/http";
import { normalizePr } from "./classify";
import type {
  ChecksState,
  GitHubConnectionConfig,
  NormalizedPr,
  RawGitHubPr,
} from "./types";

// GitHubIntegrationService — server-side client for the GitHub REST API.
// Authenticates with a Personal Access Token (read access to the repo). Tokens
// live encrypted in the DB and are decrypted only here; never sent to the browser.

const API = "https://api.github.com";
const CHECKS_CAP = 50; // max open PRs to resolve check status for (rate-limit guard)

export function isValidRepoPart(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value);
}

async function ghFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  // fetchWithRetry: timeout duro + backoff en 429/5xx respetando X-RateLimit-Reset.
  return fetchWithRetry(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  repoFullName?: string;
  isPrivate?: boolean;
}

export async function testGitHubConnection(
  config: GitHubConnectionConfig,
  token: string,
): Promise<TestConnectionResult> {
  if (!isValidRepoPart(config.owner) || !isValidRepoPart(config.repo)) {
    return { ok: false, error: "Owner o nombre de repo inválidos." };
  }
  if (!token.trim()) {
    return { ok: false, error: "El access token no puede estar vacío." };
  }

  try {
    const res = await ghFetch(
      `/repos/${config.owner}/${config.repo}`,
      token,
    );
    if (res.status === 401) {
      return { ok: false, error: "Token inválido o expirado." };
    }
    if (res.status === 404) {
      return {
        ok: false,
        error:
          "No se encontró el repositorio. Revisá owner/repo. Si es de una organización, el token fine-grained debe tener a la organización como \"Resource owner\", incluir el repo en \"Repository access\" y estar aprobado por la org (no \"pending\").",
      };
    }
    if (!res.ok) {
      return { ok: false, error: `GitHub respondió con estado ${res.status}.` };
    }
    const repo = (await res.json()) as {
      full_name?: string;
      private?: boolean;
    };
    return {
      ok: true,
      repoFullName: repo.full_name,
      isPrivate: repo.private,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Error de red al conectar con GitHub: ${err.message}`
          : "Error desconocido al conectar con GitHub.",
    };
  }
}

/**
 * Resolves the aggregate check status for a commit SHA using the Check Runs API.
 */
async function getChecksState(
  config: GitHubConnectionConfig,
  token: string,
  sha: string | undefined,
): Promise<ChecksState> {
  if (!sha) return "unknown";
  try {
    const res = await ghFetch(
      `/repos/${config.owner}/${config.repo}/commits/${sha}/check-runs?per_page=100`,
      token,
    );
    if (!res.ok) return "unknown";
    const data = (await res.json()) as {
      total_count?: number;
      check_runs?: Array<{ status?: string; conclusion?: string | null }>;
    };
    const runs = data.check_runs ?? [];
    if (runs.length === 0) return "none";

    let anyPending = false;
    let anyFailure = false;
    for (const run of runs) {
      if (run.status && run.status !== "completed") anyPending = true;
      const c = run.conclusion;
      if (
        c === "failure" ||
        c === "timed_out" ||
        c === "cancelled" ||
        c === "action_required"
      ) {
        anyFailure = true;
      } else if (c === null || c === undefined) {
        anyPending = true;
      }
    }
    if (anyFailure) return "failure";
    if (anyPending) return "pending";
    return "success";
  } catch {
    return "unknown";
  }
}

async function listPulls(
  config: GitHubConnectionConfig,
  token: string,
  state: "open" | "closed",
): Promise<RawGitHubPr[]> {
  const params = new URLSearchParams({
    state,
    per_page: "100",
    sort: "updated",
    direction: "desc",
  });
  const res = await ghFetch(
    `/repos/${config.owner}/${config.repo}/pulls?${params.toString()}`,
    token,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `GitHub devolvió estado ${res.status} al listar PRs. ${detail.slice(0, 200)}`,
    );
  }
  return (await res.json()) as RawGitHubPr[];
}

export interface FetchPrsOptions {
  /** Include merged/closed PRs updated on/after this ISO date. Defaults to 7 days ago. */
  since?: string;
}

/**
 * Fetches open PRs plus PRs merged/closed within the period, normalizes them and
 * resolves check status for open PRs (capped to avoid rate limits).
 */
export async function fetchPullRequests(
  config: GitHubConnectionConfig,
  token: string,
  options: FetchPrsOptions = {},
): Promise<NormalizedPr[]> {
  const now = new Date();
  const since = options.since
    ? new Date(options.since)
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [openRaw, closedRaw] = await Promise.all([
    listPulls(config, token, "open"),
    listPulls(config, token, "closed"),
  ]);

  // Closed PRs relevant to the period: merged or closed within [since, now].
  const closedInPeriod = closedRaw.filter((pr) => {
    const stamp = pr.merged_at ?? pr.closed_at;
    return stamp ? new Date(stamp) >= since : false;
  });

  // Resolve checks only for open PRs, capped.
  const checksByNumber = new Map<number, ChecksState>();
  const openForChecks = openRaw.slice(0, CHECKS_CAP);
  await Promise.all(
    openForChecks.map(async (pr) => {
      checksByNumber.set(
        pr.number,
        await getChecksState(config, token, pr.head?.sha),
      );
    }),
  );

  const normalized: NormalizedPr[] = [
    ...openRaw.map((pr) =>
      normalizePr(pr, checksByNumber.get(pr.number) ?? "unknown", now),
    ),
    ...closedInPeriod.map((pr) => normalizePr(pr, "none", now)),
  ];

  return normalized;
}
