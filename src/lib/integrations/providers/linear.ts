import type {
  ProviderAdapter,
  UnifiedWorkItem,
  WorkItemBucket,
} from "../types";
import { demoDataFor, isDemo, periodDaysFrom } from "../demo";

// Linear adapter — GraphQL API. Personal API keys go in the Authorization header
// directly (no "Bearer" prefix).

const ENDPOINT = "https://api.linear.app/graphql";
const STALE_DAYS = 5;
const CRITICAL_PRIORITIES = new Set(["urgent", "high"]);

async function linearQuery(
  key: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: unknown; errors?: Array<{ message: string }> }> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  return (await res.json()) as {
    data?: unknown;
    errors?: Array<{ message: string }>;
  };
}

interface LinearIssueNode {
  identifier: string;
  title: string;
  priorityLabel: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  url: string;
  estimate: number | null;
  state: { name: string; type: string } | null;
  assignee: { name: string } | null;
  labels: { nodes: Array<{ name: string }> } | null;
  team: { key: string } | null;
}

function mapBucket(
  stateType: string | undefined,
  labels: string[],
): WorkItemBucket {
  if (labels.some((l) => /blocked|bloque/i.test(l))) return "BLOCKED";
  switch (stateType) {
    case "completed":
    case "canceled":
      return "DONE";
    case "started":
      return "IN_PROGRESS";
    default:
      return "TODO"; // backlog, unstarted, triage
  }
}

export const linearAdapter: ProviderAdapter = {
  slug: "linear",
  async testConnection(ctx) {
    if (isDemo(ctx.config)) return { ok: true, detail: "Modo demo" };
    try {
      const r = await linearQuery(ctx.secret, `{ viewer { id name } }`);
      if (r.errors?.length) {
        return { ok: false, error: "API key de Linear inválida." };
      }
      const viewer = (r.data as { viewer?: { name?: string } })?.viewer;
      return { ok: true, detail: `Conectado como ${viewer?.name ?? "?"}` };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Error de red con Linear: ${err.message}`
            : "Error desconocido con Linear.",
      };
    }
  },

  async fetchData(ctx, opts) {
    if (isDemo(ctx.config)) return demoDataFor("linear", periodDaysFrom(opts));
    const teamKey = ctx.config.teamKey?.trim();
    const filter = teamKey
      ? `, filter: { team: { key: { eq: "${teamKey}" } } }`
      : "";
    const query = `{
      issues(first: 100, orderBy: updatedAt${filter}) {
        nodes {
          identifier title priorityLabel createdAt updatedAt completedAt url estimate
          state { name type }
          assignee { name }
          labels { nodes { name } }
          team { key }
        }
      }
    }`;
    const r = await linearQuery(ctx.secret, query);
    if (r.errors?.length) {
      throw new Error(`Linear: ${r.errors[0].message}`);
    }
    const nodes =
      (r.data as { issues?: { nodes?: LinearIssueNode[] } })?.issues?.nodes ??
      [];
    const now = Date.now();

    const workItems: UnifiedWorkItem[] = nodes.map((n) => {
      const labels = n.labels?.nodes?.map((l) => l.name) ?? [];
      const bucket = mapBucket(n.state?.type, labels);
      const priority = n.priorityLabel;
      const isDone = bucket === "DONE";
      const updatedMs = n.updatedAt ? new Date(n.updatedAt).getTime() : now;
      const isStale =
        !isDone && (now - updatedMs) / (1000 * 60 * 60 * 24) > STALE_DAYS;
      return {
        source: "linear",
        externalId: n.identifier,
        title: n.title,
        status: n.state?.name ?? "Desconocido",
        bucket,
        assignee: n.assignee?.name ?? null,
        priority,
        isCritical: priority
          ? CRITICAL_PRIORITIES.has(priority.toLowerCase())
          : false,
        isStale,
        storyPoints: n.estimate,
        labels,
        type: null,
        project: n.team?.key ?? null,
        sprint: null,
        url: n.url,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        resolvedAt: n.completedAt,
      };
    });
    return { workItems };
  },
};
