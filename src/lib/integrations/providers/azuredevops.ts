import { safeFetch } from "@/lib/http";
import type {
  CodeChangeState,
  ProviderAdapter,
  UnifiedCodeChange,
} from "../types";

// Azure DevOps adapter (CODE — Azure Repos PRs). Auth: Basic base64(":"+PAT).

const OLD_HOURS = 72;

function authHeader(pat: string) {
  return `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
}

function base(org: string, project: string, repo: string) {
  return `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repo}`;
}

interface RawPr {
  pullRequestId: number;
  title: string;
  status: string; // active | completed | abandoned
  creationDate: string;
  closedDate?: string;
  createdBy?: { displayName?: string };
  reviewers?: unknown[];
}

function mapState(s: string): CodeChangeState {
  if (s === "completed") return "MERGED";
  if (s === "abandoned") return "CLOSED";
  return "OPEN";
}

export const azureDevopsAdapter: ProviderAdapter = {
  slug: "azure-devops",
  async testConnection(ctx) {
    const { organization, project, repositoryId } = ctx.config;
    try {
      const res = await safeFetch(
        `${base(organization, project, repositoryId)}?api-version=7.0`,
        { headers: { Authorization: authHeader(ctx.secret) }, cache: "no-store" },
      );
      if (res.status === 401 || res.status === 203)
        return { ok: false, error: "PAT inválido o sin permisos." };
      if (res.status === 404)
        return { ok: false, error: "No se encontró el repositorio." };
      if (!res.ok) return { ok: false, error: `Azure respondió ${res.status}.` };
      return { ok: true, detail: `${organization}/${project}/${repositoryId}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const { organization, project, repositoryId } = ctx.config;
    const headers = { Authorization: authHeader(ctx.secret) };
    const now = Date.now();
    const webBase = `https://dev.azure.com/${organization}/${project}/_git/${repositoryId}/pullrequest`;

    async function list(status: string): Promise<RawPr[]> {
      const res = await safeFetch(
        `${base(organization, project, repositoryId)}/pullrequests?searchCriteria.status=${status}&$top=50&api-version=7.0`,
        { headers, cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Azure devolvió ${res.status}.`);
      const data = (await res.json()) as { value?: RawPr[] };
      return data.value ?? [];
    }

    const [active, completed] = await Promise.all([
      list("active"),
      list("completed"),
    ]);
    const codeChanges: UnifiedCodeChange[] = [...active, ...completed].map((pr) => {
      const state = mapState(pr.status);
      const ageHours =
        state === "OPEN"
          ? (now - new Date(pr.creationDate).getTime()) / (1000 * 60 * 60)
          : 0;
      const isOld = state === "OPEN" && ageHours > OLD_HOURS;
      const reviewerCount = pr.reviewers?.length ?? 0;
      return {
        source: "azure-devops",
        externalId: String(pr.pullRequestId),
        title: pr.title,
        author: pr.createdBy?.displayName ?? null,
        state,
        reviewerCount,
        hasReviewer: reviewerCount > 0,
        checksState: "unknown",
        draft: false,
        ageHours,
        isOld,
        isRisk: state === "OPEN" && isOld,
        url: `${webBase}/${pr.pullRequestId}`,
        createdAt: pr.creationDate,
        updatedAt: pr.closedDate ?? pr.creationDate,
        mergedAt: state === "MERGED" ? pr.closedDate ?? null : null,
        closedAt: state === "CLOSED" ? pr.closedDate ?? null : null,
      };
    });
    return { codeChanges };
  },
};
