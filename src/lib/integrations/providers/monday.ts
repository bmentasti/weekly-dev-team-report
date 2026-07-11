import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// monday.com (PLANNING). Auth: Authorization: <token>. API GraphQL v2.
const API = "https://api.monday.com/v2";

interface RawItem {
  id: string;
  name: string;
  updated_at?: string | null;
  created_at?: string | null;
  column_values?: { id: string; text: string | null }[];
}
interface Resp {
  data?: { boards?: { items_page?: { items?: RawItem[] } }[] };
  errors?: unknown;
}

async function gql(token: string, query: string): Promise<Resp> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": "2023-10",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(httpError(res.status, "monday"));
  return (await res.json()) as Resp;
}

export const mondayAdapter: ProviderAdapter = {
  slug: "monday",
  async testConnection(ctx) {
    try {
      const r = await gql(ctx.secret, "query { me { id } }");
      if (r.errors) return { ok: false, error: "Token inválido." };
      return { ok: true, detail: "Cuenta conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const query = `query { boards(ids: [${ctx.config.boardId}]) { items_page(limit: 100) { items { id name updated_at created_at column_values { id text } } } } }`;
    const r = await gql(ctx.secret, query);
    const items = r.data?.boards?.[0]?.items_page?.items ?? [];
    const workItems = items.map((it) => {
      const statusCol = (it.column_values ?? []).find(
        (c) => /status|estado/i.test(c.id) && c.text,
      );
      const status = statusCol?.text ?? "";
      const bucket = planBucket(status);
      return mkItem({
        source: "monday",
        externalId: it.id,
        title: it.name,
        status: status || "Item",
        bucket,
        url: `https://view.monday.com/${it.id}`,
        createdAt: it.created_at ?? null,
        updatedAt: it.updated_at ?? null,
        isStale: isStale(it.updated_at ?? null, bucket === "DONE"),
      });
    });
    return { workItems };
  },
};
