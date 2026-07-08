import { describe, it, expect } from "vitest";
import {
  DEFAULT_STANDARD,
  METRIC_DEFS,
  PRESETS,
  evaluateMetric,
  mergeStandard,
  scoreWithStandard,
  thresholdValid,
  weightsBalanced,
  weightsSum,
  metricValue,
  diffStandards,
  computeBaselineThresholds,
  type MetricDef,
} from "./standards";
import type { ReportMetrics } from "./types";

const def = (key: string) => METRIC_DEFS.find((d) => d.key === key) as MetricDef;

describe("evaluateMetric", () => {
  it("higherIsBetter (completionRate)", () => {
    const d = def("completionRate"); // healthy 85, risk 70
    expect(evaluateMetric(d, 90, { healthy: 85, risk: 70 })).toBe("healthy");
    expect(evaluateMetric(d, 75, { healthy: 85, risk: 70 })).toBe("watch");
    expect(evaluateMetric(d, 60, { healthy: 85, risk: 70 })).toBe("risk");
  });
  it("lowerIsBetter (bugs)", () => {
    const d = def("bugs"); // healthy 3, risk 8
    expect(evaluateMetric(d, 2, { healthy: 3, risk: 8 })).toBe("healthy");
    expect(evaluateMetric(d, 6, { healthy: 3, risk: 8 })).toBe("watch");
    expect(evaluateMetric(d, 12, { healthy: 3, risk: 8 })).toBe("risk");
  });
});

describe("mergeStandard", () => {
  it("devuelve defaults cuando no hay custom", () => {
    expect(mergeStandard(null)).toEqual(DEFAULT_STANDARD);
  });
  it("completa claves faltantes y respeta overrides", () => {
    const merged = mergeStandard({ thresholds: { bugs: { healthy: 1, risk: 2 } } });
    expect(merged.thresholds.bugs).toEqual({ healthy: 1, risk: 2 });
    // el resto queda con defaults
    expect(merged.thresholds.completionRate).toEqual(
      DEFAULT_STANDARD.thresholds.completionRate,
    );
    expect(Object.keys(merged.thresholds).sort()).toEqual(
      METRIC_DEFS.map((d) => d.key).sort(),
    );
  });
  it("ignora valores no numéricos (defensivo)", () => {
    const merged = mergeStandard({
      // @ts-expect-error input inválido a propósito
      thresholds: { bugs: { healthy: "x", risk: null } },
    });
    expect(merged.thresholds.bugs).toEqual(DEFAULT_STANDARD.thresholds.bugs);
  });
});

describe("pesos y umbrales", () => {
  it("weightsSum y weightsBalanced", () => {
    expect(weightsSum(DEFAULT_STANDARD.weights)).toBe(100);
    expect(weightsBalanced(DEFAULT_STANDARD.weights)).toBe(true);
    expect(weightsBalanced({ ...DEFAULT_STANDARD.weights, risk: 50 })).toBe(false);
  });
  it("thresholdValid según dirección", () => {
    expect(thresholdValid(def("completionRate"), { healthy: 85, risk: 70 })).toBe(true);
    expect(thresholdValid(def("completionRate"), { healthy: 70, risk: 85 })).toBe(false);
    expect(thresholdValid(def("bugs"), { healthy: 3, risk: 8 })).toBe(true);
    expect(thresholdValid(def("bugs"), { healthy: 8, risk: 3 })).toBe(false);
  });
});

const healthy = {
  projectProgress: { completionByPoints: 92 },
  quality: { scopeCreepPct: 4, bugsOpen: 1 },
  workItems: { blocked: 0, critical: 0, stale: 0 },
  planning: { carryOverItems: 1 },
  capacity: { cycleTimeAvgDays: 2 },
  codeChanges: { total: 6, avgOpenAgeHours: 10 },
  ci: { total: 5, deployFailed: 0, failed: 0 },
} as unknown as ReportMetrics;

const bad = {
  projectProgress: { completionByPoints: 45 },
  quality: { scopeCreepPct: 40, bugsOpen: 15 },
  workItems: { blocked: 6, critical: 3, stale: 9 },
  planning: { carryOverItems: 8 },
  capacity: { cycleTimeAvgDays: 12 },
  codeChanges: { total: 6, avgOpenAgeHours: 120 },
  ci: { total: 5, deployFailed: 4, failed: 4 },
} as unknown as ReportMetrics;

describe("scoreWithStandard", () => {
  it("puntúa alto un sprint sano y bajo uno malo", () => {
    const good = scoreWithStandard(healthy, DEFAULT_STANDARD);
    const poor = scoreWithStandard(bad, DEFAULT_STANDARD);
    expect(good.score).not.toBeNull();
    expect(poor.score).not.toBeNull();
    expect((good.score as number) > (poor.score as number)).toBe(true);
    expect(good.level).toBe("SALUDABLE");
    expect(["RIESGO_MEDIO", "ALTO_RIESGO", "CRITICO"]).toContain(poor.level);
  });

  it("marca como sin datos las métricas sin fuente y baja la confianza", () => {
    const r = scoreWithStandard(healthy, DEFAULT_STANDARD);
    const missing = r.missing.map((m) => m.key);
    expect(missing).toContain("coverage");
    expect(missing).toContain("reviewTime");
    expect(missing).toContain("reopened");
    expect(r.confidence).toBeLessThan(1);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it("sin métricas => SIN_DATOS", () => {
    const r = scoreWithStandard(null, DEFAULT_STANDARD);
    expect(r.level).toBe("SIN_DATOS");
  });

  it("confianza baja (<0.4) => SIN_DATOS aunque el score no sea nulo", () => {
    // Solo CI conectado => única métrica con dato (deployFailures, dim quality)
    // y sin workItems no hay dimensión de riesgo => 1 sola dimensión disponible.
    const sparse = { ci: { total: 5, deployFailed: 0 } } as unknown as ReportMetrics;
    const r = scoreWithStandard(sparse, DEFAULT_STANDARD);
    expect(r.score).not.toBeNull();
    expect(r.confidence).toBeLessThan(0.4);
    expect(r.level).toBe("SIN_DATOS");
  });

  it("un umbral más estricto no sube el score", () => {
    const strict = mergeStandard({
      thresholds: { bugs: { healthy: 0, risk: 1 } },
    });
    const base = scoreWithStandard(healthy, DEFAULT_STANDARD).score as number;
    const tight = scoreWithStandard(healthy, strict).score as number;
    expect(tight).toBeLessThanOrEqual(base);
  });

  it("estándar sin umbrales ni pesos => usa defaults (ramas fallback)", () => {
    const bare = { ...DEFAULT_STANDARD, thresholds: {}, weights: {} } as unknown as typeof DEFAULT_STANDARD;
    const r = scoreWithStandard(healthy, bare);
    expect(r.score).not.toBeNull();
  });

  it("riskDim usa 0 cuando no hay ci (rama nullish)", () => {
    const noCi = {
      projectProgress: { completionByPoints: 80 },
      workItems: { blocked: 1, critical: 0, stale: 0 },
      capacity: { cycleTimeAvgDays: 2 },
      codeChanges: { total: 6, avgOpenAgeHours: 10 },
      planning: { carryOverItems: 0 },
    } as unknown as ReportMetrics; // sin ci
    const r = scoreWithStandard(noCi, DEFAULT_STANDARD);
    expect(r.score).not.toBeNull();
  });
});

describe("metricValue", () => {
  it("devuelve null cuando no hay código/CI conectado", () => {
    const noCode = { codeChanges: { total: 0 }, ci: { total: 0 } } as unknown as ReportMetrics;
    expect(metricValue("prOpenAge", noCode)).toBeNull();
    expect(metricValue("deployFailures", noCode)).toBeNull();
  });
});

describe("PRESETS", () => {
  it("cada preset tiene pesos que suman 100 y todos los umbrales", () => {
    for (const p of PRESETS) {
      expect(weightsSum(p.config.weights)).toBe(100);
      expect(Object.keys(p.config.thresholds).sort()).toEqual(
        METRIC_DEFS.map((d) => d.key).sort(),
      );
    }
  });
});

describe("diffStandards", () => {
  it("lista cambios de umbral y de peso", () => {
    const from = DEFAULT_STANDARD;
    const weightKey = Object.keys(DEFAULT_STANDARD.weights)[0];
    const to = {
      ...DEFAULT_STANDARD,
      thresholds: {
        ...DEFAULT_STANDARD.thresholds,
        bugs: { healthy: 1, risk: 2 },
      },
      weights: {
        ...DEFAULT_STANDARD.weights,
        [weightKey]: DEFAULT_STANDARD.weights[weightKey as keyof typeof DEFAULT_STANDARD.weights] + 5,
      },
    };
    const diff = diffStandards(from, to);
    const bugsHealthy = diff.thresholds.find((t) => t.key === "bugs" && t.field === "healthy");
    expect(bugsHealthy).toMatchObject({ from: 3, to: 1 });
    expect(diff.thresholds.some((t) => t.key === "bugs" && t.field === "risk")).toBe(true);
    expect(diff.weights.some((w) => w.dim === weightKey)).toBe(true);
  });
  it("sin cambios => diff vacío", () => {
    const diff = diffStandards(DEFAULT_STANDARD, DEFAULT_STANDARD);
    expect(diff.thresholds).toHaveLength(0);
    expect(diff.weights).toHaveLength(0);
  });
  it("salta métricas ausentes en algún estándar (rama continue)", () => {
    const bare = { ...DEFAULT_STANDARD, thresholds: {} } as unknown as typeof DEFAULT_STANDARD;
    const diff = diffStandards(bare, DEFAULT_STANDARD);
    expect(diff.thresholds).toHaveLength(0);
  });
});

describe("computeBaselineThresholds", () => {
  const m = (completion: number, bugs: number) =>
    ({
      projectProgress: { completionByPoints: completion },
      quality: { bugsOpen: bugs },
      codeChanges: { total: 0 },
      ci: { total: 0 },
    }) as unknown as ReportMetrics;

  it("sin histórico suficiente (<2) mantiene el recomendado", () => {
    const out = computeBaselineThresholds([m(90, 3)]);
    const def = METRIC_DEFS.find((d) => d.key === "completionRate") as MetricDef;
    expect(out.completionRate).toEqual({ healthy: def.healthy, risk: def.risk });
  });

  it("con histórico ajusta umbrales según dirección de cada métrica", () => {
    const history = [m(80, 2), m(90, 4), m(100, 6)];
    const out = computeBaselineThresholds(history);
    // higherIsBetter (completionRate): healthy por encima del risk
    expect(out.completionRate.healthy).toBeGreaterThan(out.completionRate.risk);
    // lowerIsBetter (bugs): risk por encima del healthy
    expect(out.bugs.risk).toBeGreaterThan(out.bugs.healthy);
    // todas las claves presentes
    expect(Object.keys(out).sort()).toEqual(METRIC_DEFS.map((d) => d.key).sort());
  });
});
