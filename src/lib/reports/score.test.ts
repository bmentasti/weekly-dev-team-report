import { describe, it, expect } from "vitest";
import { levelOf, levelVariant, healthScore, LEVEL_LABEL, type ScoreLevel } from "./score";
import type { ReportMetrics } from "./types";

describe("levelOf", () => {
  it("mapea los cortes de nivel (escala de 6 estados)", () => {
    expect(levelOf(95)).toBe("SALUDABLE");
    expect(levelOf(90)).toBe("SALUDABLE");
    expect(levelOf(80)).toBe("ESTABLE");
    expect(levelOf(78)).toBe("ESTABLE");
    expect(levelOf(70)).toBe("OBSERVACION");
    expect(levelOf(64)).toBe("OBSERVACION");
    expect(levelOf(55)).toBe("RIESGO_MEDIO");
    expect(levelOf(50)).toBe("RIESGO_MEDIO");
    expect(levelOf(40)).toBe("ALTO_RIESGO");
    expect(levelOf(35)).toBe("ALTO_RIESGO");
    expect(levelOf(20)).toBe("CRITICO");
    expect(levelOf(0)).toBe("CRITICO");
  });
});

describe("levelVariant", () => {
  it("mapea cada nivel a su variante visual", () => {
    const map: Record<ScoreLevel, string> = {
      SALUDABLE: "success",
      ESTABLE: "success",
      OBSERVACION: "info",
      RIESGO_MEDIO: "warning",
      ALTO_RIESGO: "destructive",
      CRITICO: "destructive",
    };
    (Object.keys(map) as ScoreLevel[]).forEach((lvl) => {
      expect(levelVariant(lvl)).toBe(map[lvl]);
    });
  });
  it("LEVEL_LABEL cubre los 6 niveles", () => {
    (Object.keys(LEVEL_LABEL) as ScoreLevel[]).forEach((lvl) => {
      expect(LEVEL_LABEL[lvl]).toBeTruthy();
    });
  });
});

function baseMetrics(over: Partial<ReportMetrics> = {}): ReportMetrics {
  return {
    workItems: { total: 20, done: 10, inProgress: 3, blocked: 0, todo: 7, stale: 0, critical: 0 },
    codeChanges: { total: 10, open: 2, merged: 8, closedNoMerge: 0, withoutReviewer: 0, checksFailing: 0, old: 0, avgOpenAgeHours: 20 },
    activity: { messages: 0, blockers: 0, activePeople: 3 },
    quality: { bugs: 0, bugsDone: 0, bugsOpen: 0, defectRatePct: 0, scopeCreepItems: 0, scopeCreepPct: 0, readyForQa: 0 },
    ci: { total: 10, success: 10, failed: 0, running: 0, failureRatePct: 0, deployFailed: 0 },
    capacity: { committedPoints: 30, completedPoints: 24, velocityPoints: 24, remainingPoints: 6, cycleTimeAvgDays: 3 },
    projectProgress: { totalItems: 20, doneItems: 10, remainingItems: 10, completionByCount: 50, completionByPoints: 90 },
    statusDistribution: { todo: 7, inProgress: 3, blocked: 0, done: 10 },
    planning: { carryOverItems: 0, carryOverPoints: 0, forecastPoints: 20, focus: [] },
    trend: [],
    people: [],
    sources: [],
    ...over,
  } as ReportMetrics;
}

describe("healthScore", () => {
  it("sin métricas: usa el fallback por HealthLevel", () => {
    expect(healthScore(null, "HEALTHY")).toBe(88);
    expect(healthScore(null, "MEDIUM_RISK")).toBe(65);
    expect(healthScore(null, "HIGH_RISK")).toBe(45);
    expect(healthScore(null, null)).toBe(60);
  });
  it("sin capacity: también usa el fallback", () => {
    expect(healthScore({ capacity: undefined } as unknown as ReportMetrics, "HEALTHY")).toBe(88);
  });
  it("parte del avance por SP cuando no hay penalizaciones", () => {
    expect(healthScore(baseMetrics(), null)).toBe(90);
  });
  it("penaliza bloqueos, stale, bugs, PRs viejos/sin reviewer y CI", () => {
    const s = healthScore(
      baseMetrics({
        workItems: { total: 20, done: 10, inProgress: 3, blocked: 3, todo: 4, stale: 2, critical: 0 },
        quality: { bugs: 4, bugsDone: 0, bugsOpen: 4, defectRatePct: 0, scopeCreepItems: 0, scopeCreepPct: 0, readyForQa: 0 },
        codeChanges: { total: 10, open: 2, merged: 8, closedNoMerge: 0, withoutReviewer: 2, checksFailing: 0, old: 3, avgOpenAgeHours: 20 },
        ci: { total: 10, success: 5, failed: 5, running: 0, failureRatePct: 50, deployFailed: 0 },
      }),
      null,
    );
    // 90 - 12 - 4 - 12 - 6 - 4 - 15 = 37
    expect(s).toBe(37);
  });
  it("usa 0 cuando faltan quality y ci (ramas nullish)", () => {
    const m = {
      workItems: { blocked: 1, stale: 1 },
      codeChanges: { old: 1, withoutReviewer: 1 },
      capacity: {},
      projectProgress: { completionByPoints: 80 },
    } as unknown as ReportMetrics;
    // 80 -4 -2 -(0) -2 -2 -(0) = 70
    expect(healthScore(m, null)).toBe(70);
  });
  it("hace clamp a 0..100", () => {
    const low = healthScore(
      baseMetrics({
        projectProgress: { totalItems: 20, doneItems: 0, remainingItems: 20, completionByCount: 0, completionByPoints: 0 },
        workItems: { total: 20, done: 0, inProgress: 0, blocked: 20, todo: 0, stale: 20, critical: 0 },
      }),
      null,
    );
    expect(low).toBe(0);
    const high = healthScore(
      baseMetrics({
        projectProgress: { totalItems: 20, doneItems: 20, remainingItems: 0, completionByCount: 100, completionByPoints: 100 },
      }),
      null,
    );
    expect(high).toBe(100);
  });
});
