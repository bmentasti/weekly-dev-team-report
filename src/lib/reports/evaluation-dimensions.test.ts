import { describe, it, expect } from "vitest";
import { computeDimensions } from "./evaluation-dimensions";
import type { PersonInsight } from "./types";

function person(extra: Partial<PersonInsight> = {}): PersonInsight {
  return {
    id: "p1",
    name: "Ana",
    tasksDone: 0,
    tasksInProgress: 0,
    tasksBlocked: 0,
    tasksStale: 0,
    prsOpen: 0,
    prsMerged: 0,
    committedPoints: 0,
    completedPoints: 0,
    wip: 0,
    throughput: 0,
    cycleTimeAvgDays: null,
    category: "ON_TRACK",
    score: 0,
    rank: 0,
    nextStep: "",
    ...extra,
  };
}

describe("evaluation-dimensions (§8)", () => {
  it("sin GitHub conectado NO castiga colaboración: queda 'no disponible', no 0", () => {
    const b = computeDimensions(person({ throughput: 5, completedPoints: 8, tasksDone: 5 }), {
      throughputSeries: [5],
      hasCode: false,
      hasPlanning: true,
    });
    const collab = b.dimensions.find((d) => d.key === "collaboration")!;
    expect(collab.available).toBe(false);
    expect(collab.score).toBeNull();
  });

  it("persona sin tareas no recibe evaluación negativa: dimensiones de planning no disponibles si no hay planning", () => {
    const b = computeDimensions(person(), {
      throughputSeries: [],
      hasCode: false,
      hasPlanning: false,
    });
    expect(b.sufficient).toBe(false);
    expect(b.overall).toBeNull();
  });

  it("con planning y buenos números, impacto es alto", () => {
    const b = computeDimensions(person({ throughput: 6, completedPoints: 10, tasksDone: 6 }), {
      throughputSeries: [3, 6],
      hasCode: false,
      hasPlanning: true,
    });
    const impact = b.dimensions.find((d) => d.key === "impact")!;
    expect(impact.available).toBe(true);
    expect(impact.score).toBeGreaterThan(70);
    // growth disponible con 2 períodos, mejora
    const growth = b.dimensions.find((d) => d.key === "growth")!;
    expect(growth.available).toBe(true);
    expect(growth.score).toBeGreaterThan(50);
  });

  it("predictibilidad requiere ≥3 períodos", () => {
    const b2 = computeDimensions(person({ throughput: 5 }), {
      throughputSeries: [5, 5],
      hasCode: true,
      hasPlanning: true,
    });
    expect(b2.dimensions.find((d) => d.key === "predictability")!.available).toBe(false);
    const b3 = computeDimensions(person({ throughput: 5 }), {
      throughputSeries: [5, 5, 5],
      hasCode: true,
      hasPlanning: true,
    });
    const pred = b3.dimensions.find((d) => d.key === "predictability")!;
    expect(pred.available).toBe(true);
    expect(pred.score).toBe(100); // varianza 0 → máxima predictibilidad
  });

  it("overall pondera solo dimensiones disponibles y sufficient necesita ≥3", () => {
    const b = computeDimensions(person({ throughput: 4, completedPoints: 6, tasksDone: 4 }), {
      throughputSeries: [2, 4, 4],
      hasCode: true,
      hasPlanning: true,
    });
    expect(b.availableCount).toBeGreaterThanOrEqual(3);
    expect(b.sufficient).toBe(true);
    expect(b.overall).not.toBeNull();
  });
});
