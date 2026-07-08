import { describe, it, expect } from "vitest";
import {
  compareMetrics,
  classifyTrends,
  comparisonAlerts,
  evolvePeople,
  planningRecommendation,
  TREND_LABEL,
  PERSON_CAT_LABEL,
} from "./compare";
import type { PersonInsight, ReportMetrics } from "./types";

function rm(over: Partial<ReportMetrics> = {}): ReportMetrics {
  return {
    workItems: { total: 20, done: 10, inProgress: 3, blocked: 1, todo: 6, stale: 0, critical: 0 },
    codeChanges: { total: 10, open: 2, merged: 8, closedNoMerge: 0, withoutReviewer: 1, checksFailing: 0, old: 1, avgOpenAgeHours: 20 },
    activity: { messages: 0, blockers: 0, activePeople: 3 },
    quality: { bugs: 5, bugsDone: 2, bugsOpen: 3, defectRatePct: 10, scopeCreepItems: 1, scopeCreepPct: 10, readyForQa: 2 },
    ci: { total: 10, success: 9, failed: 1, running: 0, failureRatePct: 10, deployFailed: 0 },
    capacity: { committedPoints: 30, completedPoints: 24, velocityPoints: 24, remainingPoints: 6, cycleTimeAvgDays: 3 },
    projectProgress: { totalItems: 20, doneItems: 10, remainingItems: 10, completionByCount: 50, completionByPoints: 80 },
    statusDistribution: { todo: 6, inProgress: 3, blocked: 1, done: 10 },
    planning: { carryOverItems: 2, carryOverPoints: 5, forecastPoints: 20, focus: [] },
    trend: [],
    people: [],
    sources: [],
    ...over,
  } as ReportMetrics;
}

describe("compareMetrics", () => {
  it("clasifica dirección según lower/higher is better", () => {
    const a = rm({ capacity: { ...rm().capacity, velocityPoints: 30 }, workItems: { ...rm().workItems, blocked: 5 } });
    const b = rm({ capacity: { ...rm().capacity, velocityPoints: 20 }, workItems: { ...rm().workItems, blocked: 2 } });
    const res = compareMetrics(a, b);
    expect(res).toHaveLength(12);
    expect(res.find((r) => r.key === "velocity")?.direction).toBe("good");
    expect(res.find((r) => r.key === "blocked")?.direction).toBe("bad");
  });
  it("deltaPct null cuando base es 0", () => {
    const a = rm({ workItems: { ...rm().workItems, blocked: 3 } });
    const b = rm({ workItems: { ...rm().workItems, blocked: 0 } });
    expect(compareMetrics(a, b).find((r) => r.key === "blocked")?.deltaPct).toBeNull();
  });
  it("sin cambio => neutral", () => {
    const res = compareMetrics(rm(), rm());
    expect(res.every((r) => r.deltaAbs !== 0 || r.direction === "neutral")).toBe(true);
  });
});

describe("classifyTrends", () => {
  it("devuelve 9 dimensiones con clase válida", () => {
    const res = classifyTrends(rm(), rm());
    expect(res).toHaveLength(9);
    for (const r of res) expect(TREND_LABEL[r.class]).toBeTruthy();
  });
  it("mejora clara cuando sube fuerte", () => {
    const a = rm({ workItems: { ...rm().workItems, done: 40 } });
    const b = rm({ workItems: { ...rm().workItems, done: 10 } });
    expect(classifyTrends(a, b).find((r) => r.dimension === "Entrega")?.class).toBe("MEJORA_CLARA");
  });
  it("mejora leve con subida moderada (8–25%)", () => {
    const a = rm({ workItems: { ...rm().workItems, done: 55 } });
    const b = rm({ workItems: { ...rm().workItems, done: 50 } }); // +10%
    expect(classifyTrends(a, b).find((r) => r.dimension === "Entrega")?.class).toBe("MEJORA_LEVE");
  });
  it("deterioro crítico cuando baja fuerte", () => {
    const a = rm({ workItems: { ...rm().workItems, done: 10 } });
    const b = rm({ workItems: { ...rm().workItems, done: 40 } }); // -75%
    expect(classifyTrends(a, b).find((r) => r.dimension === "Entrega")?.class).toBe("DETERIORO_CRITICO");
  });
  it("deterioro leve con caída moderada (8–25%)", () => {
    const a = rm({ workItems: { ...rm().workItems, done: 42 } });
    const b = rm({ workItems: { ...rm().workItems, done: 50 } }); // -16%
    expect(classifyTrends(a, b).find((r) => r.dimension === "Entrega")?.class).toBe("DETERIORO_LEVE");
  });
  it("base 0: mejora si sube desde 0, sin cambio si ambos 0, deterioro si empeora desde 0", () => {
    const up = classifyTrends(
      rm({ workItems: { ...rm().workItems, done: 5 } }),
      rm({ workItems: { ...rm().workItems, done: 0 } }),
    ).find((r) => r.dimension === "Entrega")?.class;
    expect(up).toBe("MEJORA_CLARA");
    const flat = classifyTrends(
      rm({ quality: { ...rm().quality, bugsOpen: 0 } }),
      rm({ quality: { ...rm().quality, bugsOpen: 0 } }),
    ).find((r) => r.dimension === "Calidad (bugs)")?.class;
    expect(flat).toBe("SIN_CAMBIO");
    const worse = classifyTrends(
      rm({ quality: { ...rm().quality, bugsOpen: 5 } }),
      rm({ quality: { ...rm().quality, bugsOpen: 0 } }),
    ).find((r) => r.dimension === "Calidad (bugs)")?.class;
    expect(worse).toBe("DETERIORO_CRITICO");
  });
});

describe("comparisonAlerts", () => {
  it("levanta alertas de deterioro", () => {
    const a = rm({
      planning: { ...rm().planning, carryOverItems: 5 },
      projectProgress: { ...rm().projectProgress, completionByPoints: 60 },
      capacity: { ...rm().capacity, velocityPoints: 10, cycleTimeAvgDays: 5 },
      codeChanges: { ...rm().codeChanges, old: 5 },
      quality: { ...rm().quality, bugsOpen: 9, scopeCreepPct: 30 },
    });
    const b = rm();
    const ids = comparisonAlerts(a, b).map((x) => x.id);
    expect(ids).toContain("velocity-down");
    expect(ids).toContain("completion-down");
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });
  it("sin deterioro => sin alertas", () => {
    expect(comparisonAlerts(rm(), rm())).toHaveLength(0);
  });
});

function person(name: string, over: Partial<PersonInsight> = {}): PersonInsight {
  return {
    name, tasksDone: 3, tasksInProgress: 1, tasksBlocked: 0, tasksStale: 0,
    prsOpen: 1, prsMerged: 2, committedPoints: 8, completedPoints: 6, wip: 1,
    throughput: 3, cycleTimeAvgDays: 2, category: "ON_TRACK", score: 70, rank: 1, nextStep: "-",
    ...over,
  };
}

describe("evolvePeople", () => {
  it("une personas de ambos sprints y clasifica", () => {
    const a = rm({ people: [person("Ana", { throughput: 5 })] });
    const b = rm({ people: [person("Ana", { throughput: 2 }), person("Beto")] });
    const res = evolvePeople(a, b);
    expect(res.map((r) => r.name)).toEqual(["Ana", "Beto"]);
    expect(res[0].movement).toBe("up");
    expect(PERSON_CAT_LABEL[res[0].category]).toBeTruthy();
  });
  it("classifyEvolution cubre todas las categorías y movimientos", () => {
    const a = rm({
      people: [
        person("Dest", { throughput: 5 }), // DESTACADA
        person("Riesgo", { tasksBlocked: 1 }), // BAJO
        person("Obs", { tasksBlocked: 1 }), // BAJO
        person("Estable"), // CUMPLE, throughput 3
        person("Mas", { throughput: 2 }), // CUMPLE, throughput 2
      ],
    });
    const b = rm({
      people: [
        person("Dest", { throughput: 5 }), // flat
        person("Riesgo", { tasksBlocked: 1 }), // prev BAJO => RIESGO
        person("Obs"), // prev CUMPLE => OBSERVACION
        person("Estable", { throughput: 1 }), // up
        person("Mas", { throughput: 2 }), // flat
      ],
    });
    const res = evolvePeople(a, b);
    const cat = Object.fromEntries(res.map((r) => [r.name, r.category]));
    expect(cat.Dest).toBe("DESTACADA");
    expect(cat.Riesgo).toBe("RIESGO");
    expect(cat.Obs).toBe("OBSERVACION");
    expect(cat.Estable).toBe("ESTABLE");
    expect(cat.Mas).toBe("CUMPLE_MAS");
    const mv = Object.fromEntries(res.map((r) => [r.name, r.movement]));
    expect(mv.Dest).toBe("flat");
    expect(mv.Estable).toBe("up");
  });
});

describe("planningRecommendation", () => {
  it("promedia velocity y arma notas", () => {
    const a = rm({ capacity: { ...rm().capacity, velocityPoints: 18 }, quality: { ...rm().quality, bugsOpen: 3, scopeCreepPct: 30 }, workItems: { ...rm().workItems, blocked: 2 }, planning: { ...rm().planning, carryOverItems: 2 } });
    const b = rm({ capacity: { ...rm().capacity, velocityPoints: 22 } });
    const rec = planningRecommendation(a, b);
    expect(rec.suggestedCapacity).toBe(20);
    expect(rec.notes.length).toBeGreaterThan(0);
    expect(rec.margin).toContain("20%");
    // declining (18 < 22) => scope conservador
    expect(rec.scope).toContain("conservador");
  });
  it("con quality/planning ausentes usa 0 (ramas nullish) => sin notas, margen 10-15%", () => {
    const a = {
      ...rm(),
      quality: undefined,
      workItems: { done: 1, blocked: 0 },
      planning: { carryOverItems: 0 },
      capacity: { velocityPoints: 20, cycleTimeAvgDays: 3 },
    } as unknown as ReportMetrics;
    const b = { ...rm(), capacity: { velocityPoints: 20, cycleTimeAvgDays: 3 } } as ReportMetrics;
    const rec = planningRecommendation(a, b);
    expect(rec.notes).toHaveLength(0);
    expect(rec.margin).toContain("10-15%");
  });
  it("velocity estable/al alza => scope en línea, sin notas, margen 10-15%", () => {
    const a = rm({ capacity: { ...rm().capacity, velocityPoints: 25 }, quality: { ...rm().quality, bugsOpen: 0, scopeCreepPct: 0 }, workItems: { ...rm().workItems, blocked: 0 }, planning: { ...rm().planning, carryOverItems: 0 } });
    const b = rm({ capacity: { ...rm().capacity, velocityPoints: 20 } });
    const rec = planningRecommendation(a, b);
    expect(rec.suggestedCapacity).toBe(23); // round((25+20)/2)
    expect(rec.scope).toContain("en línea");
    expect(rec.notes).toHaveLength(0);
    expect(rec.margin).toContain("10-15%");
  });
});
