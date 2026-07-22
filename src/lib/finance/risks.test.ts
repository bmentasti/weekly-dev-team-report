import { describe, it, expect } from "vitest";
import { scopeCreep, reworkImpact, blockerImpact, committedPlusActualBlockerCost } from "./risks";

describe("scopeCreep (§15)", () => {
  it("separa crecimiento aprobado del no aprobado (caso 20 del spec)", () => {
    // Alcance +17%, sólo 6% aprobado.
    const r = scopeCreep({
      originalScopeValue: 100_000,
      approvedAddedValue: 6_000,
      unapprovedAddedValue: 11_000,
    });
    expect(r.growthPct).toBe(17);
    expect(r.approvedGrowthPct).toBe(6);
    expect(r.unapprovedGrowthPct).toBe(11);
    expect(r.hasUnapprovedCreep).toBe(true);
  });
  it("scope creep aprobado no marca creep no aprobado (caso 6)", () => {
    const r = scopeCreep({ originalScopeValue: 100_000, approvedAddedValue: 20_000, unapprovedAddedValue: 0 });
    expect(r.hasUnapprovedCreep).toBe(false);
    expect(r.growthPct).toBe(20);
  });
  it("sin alcance original => insuficiente, no inventa", () => {
    const r = scopeCreep({ originalScopeValue: null, approvedAddedValue: 5_000 });
    expect(r.insufficientData).toBe(true);
    expect(r.growthPct).toBeNull();
  });
});

describe("reworkImpact (§16)", () => {
  it("calcula % y marca significativo (caso: 14% del costo laboral)", () => {
    const r = reworkImpact({ reworkCost: 14_000, totalLaborCost: 100_000 });
    expect(r.reworkPct).toBe(14);
    expect(r.significant).toBe(true);
  });
  it("por debajo del umbral no es significativo", () => {
    const r = reworkImpact({ reworkCost: 4_000, totalLaborCost: 100_000 });
    expect(r.reworkPct).toBe(4);
    expect(r.significant).toBe(false);
  });
  it("sin costo laboral => insuficiente (no divide por cero)", () => {
    const r = reworkImpact({ reworkCost: 5_000, totalLaborCost: 0 });
    expect(r.insufficientData).toBe(true);
    expect(r.reworkPct).toBeNull();
  });
});

describe("blockerImpact (§17)", () => {
  it("separa naturalezas y no mezcla potencial con real", () => {
    const r = blockerImpact({ actualCost: 3_000, committedCost: 1_000, potentialCost: 5_000, opportunityCost: 2_000 });
    expect(r.actualCost).toBe(3_000);
    expect(r.potentialCost).toBe(5_000);
    // Sólo real + comprometido cuenta como costo imputable a hoy.
    expect(committedPlusActualBlockerCost(r)).toBe(4_000);
  });
  it("sin registros => insuficiente", () => {
    const r = blockerImpact({});
    expect(r.insufficientData).toBe(true);
    expect(committedPlusActualBlockerCost(r)).toBeNull();
  });
});
