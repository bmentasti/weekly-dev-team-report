import { describe, it, expect } from "vitest";
import {
  computeEvaluationConfidence,
  participantMappingCoverage,
  traceabilityCoverage,
  gateVerdict,
  providerCategory,
} from "./evaluation-confidence";

describe("evaluation confidence", () => {
  it("alta: planning+code+ci conectados, buen mapeo y trazabilidad", () => {
    const c = computeEvaluationConfidence({
      connectedProviders: ["jira", "github", "jenkins"],
      requiredCategories: ["planning", "code"],
      participantMappingCoverage: 0.95,
      dataCompleteness: 0.9,
      traceabilityCoverage: 0.8,
    });
    expect(c.level).toBe("high");
    expect(c.connectedIntegrations).toEqual(expect.arrayContaining(["planning", "code", "ci"]));
    expect(c.missingIntegrations).toHaveLength(0);
  });

  it("media: hay tareas y código pero falta testing/deploys", () => {
    const c = computeEvaluationConfidence({
      connectedProviders: ["jira", "github"],
      requiredCategories: ["planning", "code", "quality"],
      participantMappingCoverage: 0.7,
      dataCompleteness: 0.6,
      traceabilityCoverage: 0.5,
    });
    expect(c.level).toBe("medium");
    expect(c.missingIntegrations).toContain("quality");
  });

  it("baja: participantes sin vincular y datos parciales", () => {
    const c = computeEvaluationConfidence({
      connectedProviders: ["jira"],
      requiredCategories: ["planning", "code"],
      participantMappingCoverage: 0.2,
      dataCompleteness: 0.3,
      traceabilityCoverage: 0.1,
    });
    expect(c.level).toBe("low");
    expect(c.warnings.length).toBeGreaterThan(0);
  });

  it("gateVerdict suprime el veredicto categórico con confianza baja", () => {
    const low = computeEvaluationConfidence({
      connectedProviders: [],
      participantMappingCoverage: 0,
      dataCompleteness: 0,
      traceabilityCoverage: 0,
    });
    const gated = gateVerdict("BAJO", low);
    expect(gated.show).toBe(false);
    expect(gated.verdict).toBeNull();
    expect(gated.fixFirst.length).toBeGreaterThan(0);
  });

  it("gateVerdict muestra el veredicto con confianza alta", () => {
    const high = computeEvaluationConfidence({
      connectedProviders: ["jira", "github", "jenkins"],
      participantMappingCoverage: 1,
      dataCompleteness: 1,
      traceabilityCoverage: 1,
    });
    const gated = gateVerdict("DESTACADA", high);
    expect(gated.show).toBe(true);
    expect(gated.verdict).toBe("DESTACADA");
  });

  it("participantMappingCoverage cuenta personas con identidad canónica", () => {
    const cov = participantMappingCoverage([
      { id: "person-1", name: "Ana Díaz" }, // mapeada
      { id: "bruno", name: "bruno" }, // id === name → cruda, no mapeada
      { id: undefined, name: "sin id" }, // no mapeada
    ]);
    expect(cov).toBeCloseTo(1 / 3, 5);
  });

  it("traceabilityCoverage: fracción de tareas hechas con PR mergeado", () => {
    const cov = traceabilityCoverage([
      { tasksDone: 4, prsMerged: 2 },
      { tasksDone: 0, prsMerged: 0 },
    ]);
    expect(cov).toBeCloseTo(0.5, 5);
  });

  it("mapea slugs a categorías", () => {
    expect(providerCategory("github")).toBe("code");
    expect(providerCategory("JIRA")).toBe("planning");
    expect(providerCategory("desconocido")).toBeNull();
  });
});
