import { describe, it, expect } from "vitest";
import { computeConfidence, confidenceBand, type ConfidenceInput } from "./confidence";

const ideal: ConfidenceInput = {
  sourceCount: 3,
  hasPrimarySource: true,
  consistency: 1,
  freshnessDays: 1,
  hasHistory: true,
  directEvidence: true,
  missingRatio: 0,
  permissionOk: true,
  syncErrors: 0,
  inferenceDependency: 0,
  aiDependency: 0,
};

describe("Confidence Score", () => {
  it("bandas por umbral", () => {
    expect(confidenceBand(10)).toBe("INSUFICIENTE");
    expect(confidenceBand(30)).toBe("BAJO");
    expect(confidenceBand(60)).toBe("MEDIO");
    expect(confidenceBand(80)).toBe("ALTO");
    expect(confidenceBand(90)).toBe("MUY_ALTO");
  });

  it("escenario ideal → Muy alto", () => {
    const r = computeConfidence(ideal);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.band).toBe("MUY_ALTO");
    expect(r.positives.length).toBeGreaterThan(0);
  });

  it("sin fuentes → 0 / Insuficiente", () => {
    const r = computeConfidence({ ...ideal, sourceCount: 0, freshnessDays: null });
    expect(r.score).toBe(0);
    expect(r.band).toBe("INSUFICIENTE");
    expect(r.negatives.length).toBeGreaterThan(0);
  });

  it("penaliza datos viejos y errores de sync", () => {
    const good = computeConfidence(ideal).score;
    const bad = computeConfidence({
      ...ideal,
      freshnessDays: 15,
      syncErrors: 2,
      missingRatio: 0.5,
    }).score;
    expect(bad).toBeLessThan(good);
  });

  it("señal indirecta y dependencia de IA bajan el score y quedan registradas", () => {
    const r = computeConfidence({
      ...ideal,
      directEvidence: false,
      inferenceDependency: 0.8,
      aiDependency: 0.7,
    });
    expect(r.score).toBeLessThan(computeConfidence(ideal).score);
    expect(r.negatives.some((n) => /indirecta|inferencias|IA/i.test(n))).toBe(true);
  });
});
