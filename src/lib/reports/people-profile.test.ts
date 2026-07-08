import { describe, it, expect } from "vitest";
import {
  computeTier,
  contextHypotheses,
  sustainedLow,
  coachingSteps,
  tierVariant,
  TIER_LABEL,
  type PerfTier,
} from "./people-profile";
import type { PersonInsight } from "./types";

function pi(over: Partial<PersonInsight> = {}): PersonInsight {
  return {
    name: "X",
    tasksDone: 3,
    tasksInProgress: 1,
    tasksBlocked: 0,
    tasksStale: 0,
    prsOpen: 1,
    prsMerged: 2,
    committedPoints: 8,
    completedPoints: 6,
    wip: 1,
    throughput: 2,
    cycleTimeAvgDays: 2,
    category: "ON_TRACK",
    score: 70,
    rank: 1,
    nextStep: "-",
    ...over,
  };
}

describe("computeTier", () => {
  it("null => CUMPLE", () => {
    expect(computeTier(null)).toBe("CUMPLE");
  });
  it("DESTACADA con throughput alto y sin bloqueos", () => {
    expect(computeTier(pi({ throughput: 5, tasksBlocked: 0, tasksStale: 0 }))).toBe("DESTACADA");
  });
  it("BAJO por SUPPORT / bloqueos / stale / wip sin entrega", () => {
    expect(computeTier(pi({ category: "SUPPORT" }))).toBe("BAJO");
    expect(computeTier(pi({ tasksBlocked: 1 }))).toBe("BAJO");
    expect(computeTier(pi({ tasksStale: 2 }))).toBe("BAJO");
    expect(computeTier(pi({ wip: 2, completedPoints: 0 }))).toBe("BAJO");
  });
  it("CUMPLE en caso intermedio", () => {
    expect(computeTier(pi({ throughput: 2, wip: 1, completedPoints: 3 }))).toBe("CUMPLE");
  });
});

describe("contextHypotheses", () => {
  it("sin datos", () => {
    expect(contextHypotheses(null)).toHaveLength(1);
  });
  it("acumula hipótesis y cierra con el 1:1", () => {
    const h = contextHypotheses(pi({ tasksBlocked: 1, tasksStale: 1, wip: 5, throughput: 1, completedPoints: 0 }));
    expect(h.length).toBeGreaterThan(3);
    expect(h[h.length - 1]).toContain("1:1");
  });
});

describe("sustainedLow", () => {
  it("menos de 2 => null", () => {
    expect(sustainedLow([])).toBeNull();
    expect(sustainedLow(["BAJO"])).toBeNull();
    expect(sustainedLow(["BAJO", "CUMPLE"])).toBeNull();
  });
  it("2 consecutivos => media", () => {
    expect(sustainedLow(["CUMPLE", "BAJO", "BAJO"])).toMatchObject({ sprints: 2, severity: "media", escalate: false });
  });
  it("3+ consecutivos => alta y escala", () => {
    expect(sustainedLow(["BAJO", "BAJO", "BAJO"])).toMatchObject({ sprints: 3, severity: "alta", escalate: true });
  });
});

describe("coachingSteps / tierVariant", () => {
  it("pasos por tier", () => {
    for (const t of ["DESTACADA", "CUMPLE", "BAJO"] as PerfTier[]) {
      expect(coachingSteps(t).length).toBeGreaterThan(0);
      expect(TIER_LABEL[t]).toBeTruthy();
    }
  });
  it("variantes", () => {
    expect(tierVariant("DESTACADA")).toBe("success");
    expect(tierVariant("CUMPLE")).toBe("secondary");
    expect(tierVariant("BAJO")).toBe("warning");
  });
});
