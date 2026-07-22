import { describe, it, expect } from "vitest";
import { computeFinancialSnapshot } from "./engine";
import { generateAlerts, topAlert } from "./alerts";

const asOf = new Date("2026-06-01");

describe("generateAlerts", () => {
  it("emite alertas de consumo desalineado, EAC sobre presupuesto y margen bajo", () => {
    const s = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 100_000,
      actualCost: 74_000,
      completionPct: 51,
      contractedRevenue: 110_000,
      targetMarginPct: 20,
      burnRatePerDay: 1_000,
      bacOverride: 100_000,
      eacMethodOverride: "simple",
      bottomUpEtc: 40_000, // EAC 114k > budget 100k ; profit -4k
    });
    const alerts = generateAlerts(s, { hasMargins: true });
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("spend-ahead-of-progress");
    expect(ids).toContain("eac-over-budget");
    expect(ids).toContain("projected-loss");
    // Ordenadas por severidad: la primera es high.
    expect(alerts[0].severity).toBe("high");
    // Cada alerta trae fórmula, evidencia y acción.
    for (const a of alerts) {
      expect(a.formula).toBeTruthy();
      expect(a.evidence).toBeTruthy();
      expect(a.suggestedAction).toBeTruthy();
    }
  });

  it("hasMargins=false oculta alertas de margen/ganancia", () => {
    const s = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 100_000,
      actualCost: 74_000,
      completionPct: 51,
      contractedRevenue: 110_000,
      targetMarginPct: 20,
      bacOverride: 100_000,
      eacMethodOverride: "simple",
      bottomUpEtc: 40_000,
    });
    const ids = generateAlerts(s, { hasMargins: false }).map((a) => a.id);
    expect(ids).not.toContain("projected-loss");
    expect(ids).not.toContain("margin-below-target");
    // Las no sensibles siguen (EAC sobre presupuesto es de costo, no margen).
    expect(ids).toContain("eac-over-budget");
  });

  it("proyecto sano no dispara alertas críticas", () => {
    const s = computeFinancialSnapshot({
      modality: "FIXED_PRICE",
      currency: "USD",
      asOf,
      originalBudget: 150_000,
      actualCost: 40_000,
      completionPct: 45,
      contractedRevenue: 200_000,
      targetMarginPct: 20,
      bacOverride: 150_000,
      eacMethodOverride: "simple",
      bottomUpEtc: 90_000, // EAC 130k < budget ; margin alto
    });
    const alerts = generateAlerts(s, { hasMargins: true });
    expect(alerts.every((a) => a.severity !== "high")).toBe(true);
    expect(topAlert(generateAlerts(computeFinancialSnapshot({ modality: "FIXED_PRICE", currency: "USD", asOf }), {}))).toBeNull();
  });
});
