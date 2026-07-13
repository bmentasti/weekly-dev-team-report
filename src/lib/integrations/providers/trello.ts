import { safeFetch } from "@/lib/http";
import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Trello (PLANNING). Auth por query params: key + token.
const API = "https://api.trello.com/1";

interface RawCard {
  id: string;
  name: string;
  shortUrl: string;
  closed: boolean;
  dateLastActivity: string | null;
  due: string | null;
  dueComplete?: boolean;
  idMembers?: string[];
  labels?: { name: string }[];
  list?: { name: string };
}

export const trelloAdapter: ProviderAdapter = {
  slug: "trello",
  async testConnection(ctx) {
    try {
      const q = `key=${ctx.config.apiKey}&token=${ctx.secret}`;
      const res = await safeFetch(`${API}/members/me?${q}`, { cache: "no-store" });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Trello") };
      return { ok: true, detail: "Cuenta conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const q = `key=${ctx.config.apiKey}&token=${ctx.secret}`;
    const res = await safeFetch(
      `${API}/boards/${ctx.config.boardId}/cards?${q}&fields=name,shortUrl,closed,dateLastActivity,due,dueComplete,idMembers,labels&list=true`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Trello devolvió ${res.status}.`);
    const cards = (await res.json()) as RawCard[];
    const workItems = cards.map((c) => {
      const done = Boolean(c.dueComplete);
      const status = c.list?.name ?? (done ? "Done" : "Open");
      const bucket = planBucket(status, done);
      return mkItem({
        source: "trello",
        externalId: c.id,
        title: c.name,
        status,
        bucket,
        url: c.shortUrl,
        labels: (c.labels ?? []).map((l) => l.name).filter(Boolean),
        updatedAt: c.dateLastActivity,
        isStale: isStale(c.dateLastActivity, bucket === "DONE"),
      });
    });
    return { workItems };
  },
};
