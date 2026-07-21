import { describe, it, expect } from "vitest";
import type { UnifiedWorkItem } from "@/lib/integrations/types";
import {
  belongsToPeriod,
  dedupeWorkItems,
  hasInsufficientDates,
  scopeToSprint,
  workItemStableKey,
  scopeTagOf,
} from "./sprint-scope";

// Ventana del sprint: dos semanas.
const START = new Date("2026-07-06T00:00:00.000Z");
const END = new Date("2026-07-19T23:59:59.999Z");

function wi(partial: Partial<UnifiedWorkItem>): UnifiedWorkItem {
  // `pick` respeta un null explícito (no lo reemplaza por el default).
  const pick = <K extends keyof UnifiedWorkItem>(k: K, dflt: UnifiedWorkItem[K]) =>
    k in partial ? (partial[k] as UnifiedWorkItem[K]) : dflt;
  return {
    source: "airtable",
    externalId: partial.externalId ?? "T-1",
    recordId: partial.recordId,
    title: partial.title ?? "Tarea",
    status: partial.status ?? "To Do",
    bucket: partial.bucket ?? "TODO",
    assignee: partial.assignee ?? null,
    assignees: partial.assignees,
    priority: null,
    isCritical: false,
    isStale: partial.isStale ?? false,
    storyPoints: partial.storyPoints ?? null,
    labels: [],
    type: null,
    project: "Tasks",
    sprint: partial.sprint ?? null,
    url: partial.url ?? "https://airtable.com/app/tbl/rec1",
    createdAt: pick("createdAt", "2026-07-07T10:00:00.000Z"),
    updatedAt: pick("updatedAt", "2026-07-10T10:00:00.000Z"),
    resolvedAt: pick("resolvedAt", null),
    startedAt: pick("startedAt", null),
    dueAt: pick("dueAt", null),
  };
}

describe("sprint-scope — pertenencia y deduplicación", () => {
  it("V1: un sprint con 20 tareas únicas muestra exactamente 20", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      wi({ recordId: `rec${i}`, externalId: `T-${i}`, bucket: "IN_PROGRESS" }),
    );
    const scoped = scopeToSprint(items, START, END);
    expect(scoped.items).toHaveLength(20);
    expect(scoped.duplicatesCollapsed).toBe(0);
    expect(scoped.excludedOutOfPeriod).toBe(0);
  });

  it("V2: una tarea con dos participantes NO incrementa dos veces el total", () => {
    const shared = wi({
      recordId: "recShared",
      bucket: "IN_PROGRESS",
      assignees: ["Ana", "Beto"],
    });
    const scoped = scopeToSprint([shared], START, END);
    expect(scoped.items).toHaveLength(1);
  });

  it("V3: una tarea relacionada con varios registros no se duplica", () => {
    const a = wi({ recordId: "recX", assignees: ["Ana"] });
    const b = wi({ recordId: "recX", assignees: ["Beto"] }); // misma tarea, otra relación
    const deduped = dedupeWorkItems([a, b]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].assignees).toEqual(expect.arrayContaining(["Ana", "Beto"]));
  });

  it("V4: las tareas de otros sprints NO aparecen (abiertas y sin actividad en la ventana)", () => {
    const otherSprint = wi({
      recordId: "recOld",
      bucket: "IN_PROGRESS",
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-15T10:00:00.000Z", // toda su actividad es previa
    });
    expect(belongsToPeriod(otherSprint, START, END)).toBe(false);
  });

  it("V5: el backlog no se incluye si no fue comprometido para el período", () => {
    const backlog = wi({
      recordId: "recBacklog",
      bucket: "TODO",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-02T10:00:00.000Z",
    });
    const scoped = scopeToSprint([backlog], START, END);
    expect(scoped.items).toHaveLength(0);
    expect(scoped.excludedOutOfPeriod).toBe(1);
  });

  it("incluye completadas dentro de la ventana y excluye completadas fuera", () => {
    const doneIn = wi({
      recordId: "recDoneIn",
      bucket: "DONE",
      resolvedAt: "2026-07-12T10:00:00.000Z",
    });
    const doneOut = wi({
      recordId: "recDoneOut",
      bucket: "DONE",
      createdAt: "2026-05-01T10:00:00.000Z",
      resolvedAt: "2026-06-01T10:00:00.000Z",
    });
    expect(belongsToPeriod(doneIn, START, END)).toBe(true);
    expect(belongsToPeriod(doneOut, START, END)).toBe(false);
  });

  it("incluye tareas incorporadas durante el sprint (creadas en la ventana)", () => {
    const added = wi({
      recordId: "recAdded",
      bucket: "IN_PROGRESS",
      createdAt: "2026-07-10T10:00:00.000Z",
    });
    expect(belongsToPeriod(added, START, END)).toBe(true);
    expect(scopeTagOf(added, START)).toBe("added");
  });

  it("excluye trabajo futuro (creado después del fin del período)", () => {
    const future = wi({
      recordId: "recFuture",
      bucket: "TODO",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-02T10:00:00.000Z",
    });
    expect(belongsToPeriod(future, START, END)).toBe(false);
  });

  it("V10/insuficiente: una tarea sin ninguna fecha se clasifica aparte", () => {
    const noDates = wi({
      recordId: "recNoDates",
      createdAt: null,
      updatedAt: null,
      resolvedAt: null,
      startedAt: null,
    });
    expect(hasInsufficientDates(noDates)).toBe(true);
    const scoped = scopeToSprint([noDates], START, END);
    expect(scoped.items).toHaveLength(0);
    expect(scoped.insufficientData).toBe(1);
  });

  it("V11: la suma por estado coincide con el total de tareas únicas", () => {
    const items = [
      wi({ recordId: "r1", bucket: "DONE", resolvedAt: "2026-07-10T10:00:00.000Z" }),
      wi({ recordId: "r2", bucket: "IN_PROGRESS" }),
      wi({ recordId: "r3", bucket: "BLOCKED" }),
      wi({ recordId: "r4", bucket: "TODO", createdAt: "2026-07-08T10:00:00.000Z" }),
    ];
    const scoped = scopeToSprint(items, START, END);
    const done = scoped.items.filter((i) => i.bucket === "DONE").length;
    const inProgress = scoped.items.filter((i) => i.bucket === "IN_PROGRESS").length;
    const blocked = scoped.items.filter((i) => i.bucket === "BLOCKED").length;
    const todo = scoped.items.filter((i) => i.bucket === "TODO").length;
    expect(done + inProgress + blocked + todo).toBe(scoped.items.length);
  });

  it("V13: cambiar de sprint no acumula información del período anterior (función pura)", () => {
    const items = [
      wi({ recordId: "rA", createdAt: "2026-07-08T10:00:00.000Z", updatedAt: "2026-07-09T10:00:00.000Z" }),
      wi({ recordId: "rB", createdAt: "2026-06-08T10:00:00.000Z", updatedAt: "2026-06-09T10:00:00.000Z", bucket: "IN_PROGRESS" }),
    ];
    const prevWindow = scopeToSprint(items, new Date("2026-06-01T00:00:00Z"), new Date("2026-06-14T23:59:59Z"));
    const curWindow = scopeToSprint(items, START, END);
    expect(prevWindow.items.map((i) => i.recordId)).toEqual(["rB"]);
    expect(curWindow.items.map((i) => i.recordId)).toEqual(["rA"]);
  });

  it("V14: una nueva sincronización no duplica registros ya existentes", () => {
    const first = wi({ recordId: "recSync", bucket: "IN_PROGRESS" });
    const resynced = wi({ recordId: "recSync", bucket: "DONE", updatedAt: "2026-07-15T10:00:00.000Z", resolvedAt: "2026-07-15T10:00:00.000Z" });
    const deduped = dedupeWorkItems([first, resynced, first]);
    expect(deduped).toHaveLength(1);
    // Gana el estado más reciente (DONE).
    expect(deduped[0].bucket).toBe("DONE");
  });

  it("clave estable prioriza recordId y nunca el nombre visible", () => {
    const a = wi({ recordId: "recStable", externalId: "HUMAN-1", title: "X" });
    const b = wi({ recordId: "recStable", externalId: "HUMAN-2", title: "Y" });
    expect(workItemStableKey(a)).toBe(workItemStableKey(b));
  });
});
