import type {
  CodeChangeState,
  ProviderAdapter,
  UnifiedCodeChange,
} from "../types";

// Bitbucket adapter (CODE). Auth: Basic base64(username:appPassword).

const API = "https://api.bitbucket.org/2.0";
const OLD_HOURS = 72;

function authHeader(username: string, appPassword: string) {
  return `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;
}

interface RawPr {
  id: number;
  title: string;
  state: string; // OPEN | MERGED | DECLINED | SUPERSEDED
  created_on: string;
  updated_on: string;
  author?: { display_name?: string };
  reviewers?: unknown[];
  links?: { html?: { href?: string } };
}

function mapState(s: string): CodeChangeState {
  if (s === "MERGED") return "MERGED";
  if (s === "OPEN") return "OPEN";
  return "CLOSED";
}

export const bitbucketAdapter: ProviderAdapter = {
  slug: "bitbucket",
  async testConnection(ctx) {
    const { workspace, repoSlug, username } = ctx.config;
    try {
      const res = await fetch(`${API}/repositories/${workspace}/${repoSlug}`, {
        headers: { Authorization: authHeader(username ?? "", ctx.secret) },
        cache: "no-store",
      });
      if (res.status === 401) return { ok: false, error: "Credenciales inválidas." };
      if (res.status === 404) return { ok: false, error: "No se encontró el repositorio." };
      if (!res.ok) return { ok: false, error: `Bitbucket respondió ${res.status}.` };
      return { ok: true, detail: `${workspace}/${repoSlug}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const { workspace, repoSlug, username } = ctx.config;
    const headers = { Authorization: authHeader(username ?? "", ctx.secret) };
    const now = Date.now();

    async function list(state: string): Promise<RawPr[]> {
      const res = await fetch(
        `${API}/repositories/${workspace}/${repoSlug}/pullrequests?state=${state}&pagelen=50`,
        { headers, cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Bitbucket devolvió ${res.status}.`);
      const data = (await res.json()) as { values?: RawPr[] };
      return data.values ?? [];
    }

    const [open, merged] = await Promise.all([list("OPEN"), list("MERGED")]);
    const codeChanges: UnifiedCodeChange[] = [...open, ...merged].map((pr) => {
      const state = mapState(pr.state);
      const ageHours =
        state === "OPEN"
          ? (now - new Date(pr.created_on).getTime()) / (1000 * 60 * 60)
          : 0;
      const isOld = state === "OPEN" && ageHours > OLD_HOURS;
      const reviewerCount = pr.reviewers?.length ?? 0;
      return {
        source: "bitbucket",
        externalId: String(pr.id),
        title: pr.title,
        author: pr.author?.display_name ?? null,
        state,
        reviewerCount,
        hasReviewer: reviewerCount > 0,
        checksState: "unknown",
        draft: false,
        ageHours,
        isOld,
        isRisk: state === "OPEN" && isOld,
        url: pr.links?.html?.href ?? "#",
        createdAt: pr.created_on,
        updatedAt: pr.updated_on,
        mergedAt: state === "MERGED" ? pr.updated_on : null,
        closedAt: state === "CLOSED" ? pr.updated_on : null,
      };
    });
    return { codeChanges };
  },
};
