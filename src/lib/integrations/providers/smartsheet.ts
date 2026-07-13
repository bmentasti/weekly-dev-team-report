import { safeFetch } from "@/lib/http";
import type { ProviderAdapter } from "../types";
import { mkItem, planBucket, isStale, httpError } from "./planning-helpers";

// Smartsheet (PLANNING). Auth: Bearer. Lee filas de una hoja y mapea columnas.
const API = "https://api.smartsheet.com/2.0";

interface Cell {
  columnId: number;
  value?: unknown;
  displayValue?: string;
}
interface Row {
  id: number;
  cells: Cell[];
  modifiedAt?: string | null;
  createdAt?: string | null;
  permalink?: string;
}
interface Column {
  id: number;
  title: string;
  primary?: boolean;
}
interface Sheet {
  id: number;
  permalink?: string;
  columns: Column[];
  rows: Row[];
}

export const smartsheetAdapter: ProviderAdapter = {
  slug: "smartsheet",
  async testConnection(ctx) {
    try {
      const res = await safeFetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${ctx.secret}` },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, error: httpError(res.status, "Smartsheet") };
      return { ok: true, detail: "Cuenta conectada" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error." };
    }
  },
  async fetchData(ctx) {
    const res = await safeFetch(`${API}/sheets/${ctx.config.sheetId}`, {
      headers: { Authorization: `Bearer ${ctx.secret}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Smartsheet devolvió ${res.status}.`);
    const sheet = (await res.json()) as Sheet;
    const primary = sheet.columns.find((c) => c.primary) ?? sheet.columns[0];
    const statusCol = sheet.columns.find((c) => /status|estado/i.test(c.title));
    const workItems = (sheet.rows ?? []).map((row) => {
      const titleCell = row.cells.find((c) => c.columnId === primary?.id);
      const statusCell = statusCol
        ? row.cells.find((c) => c.columnId === statusCol.id)
        : undefined;
      const title = titleCell?.displayValue ?? `Fila ${row.id}`;
      const status = statusCell?.displayValue ?? "";
      const bucket = planBucket(status);
      return mkItem({
        source: "smartsheet",
        externalId: String(row.id),
        title,
        status: status || "Row",
        bucket,
        url: row.permalink ?? sheet.permalink ?? "https://app.smartsheet.com",
        createdAt: row.createdAt ?? null,
        updatedAt: row.modifiedAt ?? null,
        isStale: isStale(row.modifiedAt ?? null, bucket === "DONE"),
      });
    });
    return { workItems };
  },
};
