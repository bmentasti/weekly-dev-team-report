import { describe, it, expect } from "vitest";
import { computeFinanceAlerts, type FinanceAlertInput } from "./alerts";

const base: FinanceAlertInput = {
  currency: "USD",
  eac: null,
  currentBudget: null,
  projectedProfit: null,
  projectedMarginPct: null,
  targetMarginPct: null,
  budgetRunwayDays: null,
  daysToForecastEnd: null,
  hasMargins: true,
};

describe("computeFinanceAlerts", () => {
  it("emite alerta de presupuesto excedido cuando EAC > presupuesto", () => {
    const alerts = computeFinanceAlerts({ ...base, eac: 118_400, currentBudget: 100_000 });
    const over = alerts.find((a) => a.id === "finance-over-budget");
    expect(over).toBeTruthy();
    expect(over!.level).toBe("high");
    expect(over!.roles).toContain("DIR");
  });

  it("NO emite alerta si el EAC está dentro del presupuesto", () => {
    const alerts = computeFinanceAlerts({ ...base, eac: 90_000, currentBudget: 100_000 });
    expect(alerts.find((a) => a.id === "finance-over-budget")).toBeUndefined();
  });

  it("oculta pérdida/margen sin permiso de márgenes, pero mantiene sobre-presupuesto", () => {
    const input = {
      ...base,
      eac: 130_000,
      currentBudget: 100_000,
      projectedProfit: -5_000,
      projectedMarginPct: 5,
      targetMarginPct: 20,
      hasMargins: false,
    };
    const ids = computeFinanceAlerts(input).map((a) => a.id);
    expect(ids).toContain("finance-over-budget");
    expect(ids).not.toContain("finance-projected-loss");
    expect(ids).not.toContain("finance-margin-below-target");
  });

  it("con permiso, agrega pérdida y margen bajo", () => {
    const input = {
      ...base,
      eac: 130_000,
      currentBudget: 100_000,
      projectedProfit: -5_000,
      projectedMarginPct: 5,
      targetMarginPct: 20,
      hasMargins: true,
    };
    const ids = computeFinanceAlerts(input).map((a) => a.id);
    expect(ids).toContain("finance-projected-loss");
  });

  it("sin datos financieros no emite nada", () => {
    expect(computeFinanceAlerts(null)).toEqual([]);
    expect(computeFinanceAlerts(base)).toEqual([]);
  });
});
