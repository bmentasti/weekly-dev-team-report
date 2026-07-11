import { describe, it, expect } from "vitest";
import {
  extractTicketKeys,
  correlate,
  type CorrelationSignal,
} from "./correlation";

describe("extractTicketKeys", () => {
  it("extrae claves tipo ABC-123", () => {
    expect(extractTicketKeys("Fix login timeout DEV-342")).toEqual(["DEV-342"]);
    expect(extractTicketKeys("feature/DEV-342-login")).toEqual(["DEV-342"]);
    expect(extractTicketKeys("sin clave")).toEqual([]);
    expect(extractTicketKeys(null)).toEqual([]);
  });
});

describe("correlate (caso DEV-342)", () => {
  const signals: CorrelationSignal[] = [
    { kind: "work_item", source: "jira", externalId: "DEV-342", title: "Login timeout", url: "u", bucket: "DONE" },
    { kind: "code_change", source: "github", externalId: "88", title: "Fix login timeout DEV-342", url: "u", codeState: "MERGED", hasReviewer: true, checksFailing: false, branch: "feature/DEV-342" },
    { kind: "activity", source: "slack", externalId: "m1", title: "DEV-342 listo para QA", url: "u" },
  ];

  it("agrupa las 3 señales en un mismo trabajo con alta confianza", () => {
    const groups = correlate(signals);
    const g = groups.find((x) => x.key === "DEV-342");
    expect(g).toBeDefined();
    expect(g!.signals).toHaveLength(3);
    expect(g!.confidence).toBeGreaterThanOrEqual(85);
    expect(g!.evidence).toContain("ticket_key");
    expect(g!.evidence).toContain("cross_reference");
    expect(g!.evidence).toContain("branch");
  });

  it("una señal sin clave queda como grupo propio", () => {
    const groups = correlate([
      ...signals,
      { kind: "code_change", source: "github", externalId: "99", title: "chore: bump deps", url: "u", codeState: "OPEN" },
    ]);
    const orphan = groups.find((g) => g.key === null);
    expect(orphan).toBeDefined();
    expect(orphan!.signals[0].externalId).toBe("99");
  });
});
