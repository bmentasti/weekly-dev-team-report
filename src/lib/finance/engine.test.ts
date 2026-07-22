import { describe, it, expect } from "vitest";
import { computeFinancialSnapshot } from "./engine";

const asOf = new Date("2026-06-01");

describe("computeFinancialSnapshot — integración de métricas", () => {
  it("Fixed Price saludable: compone budget, EVM y rentabilidad", () => {
    const s = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      startDate: new Date("2026-01-01"),
      plannedEndDate: new Date("2026-12-31"),
      contractualEndDate: new Date("2026-12-31"),
      forecastEndDate: new Date("2026-12-31"),
      originalBudget: 150_000,
      actualCost: 60_000,
      contractedRevenue: 200_000,
      recognizedRevenue: 80_000,
      targetMarginPct: 20,
      completionPct: 45,
      burnRatePerDay: 500,
    });
    expect(s.budget.currentBudget.value).toBe(150_000);
    expect(s.evm.bac.value).toBe(150_000);
    expect(s.evm.ev.value).toBe(67_500); // 150k * 45%
    expect(s.evm.cpi.value).toBeGreaterThan(1); // 67500/60000
    expect(s.profitability.projectedProfit.value).toBeGreaterThan(0);
    expect(["HEALTHY", "ATTENTION"]).toContain(s.status.status);
  });

  it("consumo más rápido que avance dispara la alerta de alineación", () => {
    const s = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 100_000,
      actualCost: 74_000, // 74% consumido
      completionPct: 51, // 51% avance
      contractedRevenue: 130_000,
      targetMarginPct: 20,
    });
    expect(s.budget.consumedPct.value).toBe(74);
    expect(s.progressVsSpend.aligned).toBe(false);
  });

  it("temporal: costo de atraso y días absorbibles", () => {
    const s = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 150_000,
      actualCost: 60_000,
      completionPct: 45,
      contractedRevenue: 200_000,
      targetMarginPct: 20,
      burnRatePerDay: 1_000, // costo diario del equipo
      workingDaysPerWeek: 5,
      bacOverride: 150_000,
      eacMethodOverride: "simple",
      bottomUpEtc: 90_000, // EAC = 150k -> projectedProfit = 50k
    });
    expect(s.temporal.incrementalDailyDelayCost.value).toBe(1_000);
    expect(s.temporal.incrementalWeeklyDelayCost.value).toBe(5_000);
    expect(s.temporal.breakEvenDelayDays.value).toBe(50); // 50.000 / 1.000
    expect(s.temporal.zeroMarginDate).not.toBeNull();
    // A 8 semanas (40 días) el atraso cuesta 40.000 -> profit 10.000
    const w8 = s.temporal.marginAtWeeks.find((w) => w.weeks === 8);
    expect(w8?.profit).toBe(10_000);
  });

  it("temporal sin burn rate: no calcula días absorbibles", () => {
    const s = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 100_000,
      actualCost: 40_000,
      completionPct: 50,
      contractedRevenue: 130_000,
    });
    expect(s.temporal.incrementalDailyDelayCost.value).toBeNull();
    expect(s.temporal.breakEvenDelayDays.value).toBeNull();
    expect(s.temporal.zeroMarginDate).toBeNull();
  });

  it("riesgos: scope creep no aprobado y retrabajo alimentan el estado", () => {
    const s = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 100_000,
      actualCost: 60_000,
      completionPct: 60,
      contractedRevenue: 130_000,
      targetMarginPct: 20,
      originalScopeValue: 100_000,
      approvedAddedScopeValue: 6_000,
      unapprovedAddedScopeValue: 11_000,
      reworkCost: 14_000,
      totalLaborCost: 100_000,
      blockerActualCost: 3_000,
      blockerPotentialCost: 5_000,
    });
    expect(s.risks.scopeCreep.growthPct).toBe(17);
    expect(s.risks.scopeCreep.hasUnapprovedCreep).toBe(true);
    expect(s.risks.rework.significant).toBe(true);
    expect(s.risks.blockerRealCost).toBe(3_000); // el potencial NO se suma
    expect(s.status.reasons.some((r) => r.code === "SCOPE_CREEP")).toBe(true);
    expect(s.status.reasons.some((r) => r.code === "REWORK")).toBe(true);
  });

  it("sin datos: no concluye estado ni proyecta", () => {
    const s = computeFinancialSnapshot({ modality: "FIXED_PRICE", currency: "USD", asOf });
    expect(s.profitability.projectedProfit.value).toBeNull();
    expect(s.status.status).toBe("INSUFFICIENT_DATA");
    expect(s.budget.exhaustionDate.date).toBeNull();
  });

  it("penalidad que va al costo reduce la ganancia proyectada", () => {
    const base = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 250_000,
      actualCost: 200_000,
      completionPct: 100,
      contractedRevenue: 300_000,
      targetMarginPct: 15,
      bacOverride: 250_000,
      eacMethodOverride: "simple",
      bottomUpEtc: 50_000, // EAC = 250k
    });
    const withPenalty = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 250_000,
      actualCost: 200_000,
      completionPct: 100,
      contractedRevenue: 300_000,
      targetMarginPct: 15,
      penalties: 20_000,
      penaltiesReduceRevenue: false, // va al costo
      bacOverride: 250_000,
      eacMethodOverride: "simple",
      bottomUpEtc: 50_000,
    });
    expect(base.profitability.projectedProfit.value).toBe(50_000); // 300k - 250k
    expect(withPenalty.profitability.projectedProfit.value).toBe(30_000); // 300k - 270k
  });
});
