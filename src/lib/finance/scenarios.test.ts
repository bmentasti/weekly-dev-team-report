import { describe, it, expect } from "vitest";
import { computeScenario, buildPresetScenarios, type ScenarioBase } from "./scenarios";

const base: ScenarioBase = {
  ac: 60_000,
  etc: 90_000,
  bac: 150_000,
  cpi: 0.9,
  spi: 1,
  projectedRevenue: 200_000,
  targetMarginPct: 25,
  forecastEndDate: "2026-12-31T00:00:00.000Z",
  baselineProfit: 50_000,
};

describe("computeScenario", () => {
  it("base: EAC = AC + ETC, profit = revenue − EAC", () => {
    const r = computeScenario(base, {}, { key: "base", label: "Base", confidence: "MEDIUM", confidenceReason: "x" });
    expect(r.eac).toBe(150_000);
    expect(r.profit).toBe(50_000);
    expect(r.marginPct).toBe(25);
    expect(r.vac).toBe(0);
  });
  it("optimista: menor costo restante mejora la ganancia", () => {
    const r = computeScenario(base, { etcMultiplier: 0.9 }, { key: "o", label: "O", confidence: "LOW", confidenceReason: "x" });
    expect(r.etc).toBe(81_000); // 90k*0.9
    expect(r.eac).toBe(141_000);
    expect(r.profit).toBe(59_000);
    expect(r.diffVsBaselineProfit).toBe(9_000);
  });
  it("pesimista: sobrecosto + penalidad reduce ganancia y corre la fecha", () => {
    const r = computeScenario(
      base,
      { etcMultiplier: 1.2, penalties: 10_000, daysDelta: 15 },
      { key: "p", label: "P", confidence: "LOW", confidenceReason: "x" },
    );
    expect(r.eac).toBe(168_000); // 60k + 108k
    expect(r.finalRevenue).toBe(190_000); // 200k − 10k
    expect(r.profit).toBe(22_000);
    expect(r.endDate).toBe("2027-01-15T00:00:00.000Z");
  });
  it("no inventa: sin ingreso proyectado, profit null", () => {
    const r = computeScenario({ ...base, projectedRevenue: null }, {}, { key: "x", label: "X", confidence: "LOW", confidenceReason: "y" });
    expect(r.finalRevenue).toBeNull();
    expect(r.profit).toBeNull();
  });
});

describe("buildPresetScenarios", () => {
  it("genera 4 escenarios y 'probable' proyecta la ineficiencia de CPI<1", () => {
    const list = buildPresetScenarios(base);
    expect(list.map((s) => s.key)).toEqual(["base", "optimistic", "likely", "pessimistic"]);
    const likely = list.find((s) => s.key === "likely")!;
    // CPI 0.9 -> ETC/0.9 = 100k -> EAC 160k
    expect(likely.eac).toBe(160_000);
    expect(likely.confidence).toBe("MEDIUM");
  });
});
