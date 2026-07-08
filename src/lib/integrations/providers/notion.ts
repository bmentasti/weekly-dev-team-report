import type {
  ProviderAdapter,
  UnifiedWorkItem,
  WorkItemBucket,
} from "../types";

// Notion adapter (ISSUES). Auth: Bearer token + Notion-Version header.
// Mapea páginas de una base a WorkItems (título, estado, responsable).

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const STALE_DAYS = 5;

interface NotionProp {
  type: string;
  title?: { plain_text: string }[];
  status?: { name: string } | null;
  select?: { name: string } | null;
  people?: { name?: string }[];
}
interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionProp>;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": VERSION,
    "Content-Type": "application/json",
  };
}

function bucketFor(status: string): WorkItemBucket {
  const s = status.toLowerCase();
  if (/block|bloque/.test(s)) return "BLOCKED";
  if (/done|complete|closed|listo|finaliz/.test(s)) return "DONE";
  if (/progress|doing|curso|review/.test(s)) return "IN_PROGRESS";
  return "TODO";
}

function readProps(props: Record<string, NotionProp>) {
  let title = "";
  let status = "";
  let assignee: string | null = null;
  for (const [name, prop] of Object.entries(props)) {
    if (prop.type === "title") title = prop.title?.[0]?.plain_text ?? title;
    else if (prop.type === "status") status = prop.status?.name ?? status;
    else if (prop.type === "select" && /status|estado/i.test(name))
      status = prop.select?.name ?? status;
    else if (prop.type === "people" && assignee === null)
      assignee = prop.people?.[0]?.name ?? null;
  }
  return { title, status, assignee };
}

export const notionAdapter: ProviderAdapter = {
  slug: "notion",
  async testConnection(ctx) {
    try {
      const res = await fetch(`${API}/databases/${ctx.config.databaseId}`, {
        headers: headers(ctx.secret),
        cache: "no-store",
      });
      if (res.status === 401) return { ok: false, error: "Token inválido." };
      if (res.status === 404)
        return {
          ok: false,
          error: "No se encontró la base (¿la compartiste con la integración?).",
        };
      if (!res.ok) return { ok: false, error: `Notion respondió ${res.status}.` };
      return { ok: true, detail: "Base conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await fetch(`${API}/databases/${ctx.config.databaseId}/query`, {
      method: "POST",
      headers: headers(ctx.secret),
      body: JSON.stringify({ page_size: 100 }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Notion devolvió ${res.status}.`);
    const data = (await res.json()) as { results?: NotionPage[] };
    const now = Date.now();

    const workItems: UnifiedWorkItem[] = (data.results ?? []).map((p) => {
      const { title, status, assignee } = readProps(p.properties ?? {});
      const bucket = bucketFor(status);
      const isDone = bucket === "DONE";
      const updatedMs = new Date(p.last_edited_time).getTime();
      return {
        source: "notion",
        externalId: p.id.slice(0, 8),
        title: title || "(sin título)",
        status: status || "To Do",
        bucket,
        assignee,
        priority: null,
        isCritical: false,
        isStale: !isDone && (now - updatedMs) / (1000 * 60 * 60 * 24) > STALE_DAYS,
        storyPoints: null,
        labels: [],
        type: null,
        project: null,
        sprint: null,
        url: p.url,
        createdAt: p.created_time,
        updatedAt: p.last_edited_time,
        resolvedAt: isDone ? p.last_edited_time : null,
      };
    });
    return { workItems };
  },
};
