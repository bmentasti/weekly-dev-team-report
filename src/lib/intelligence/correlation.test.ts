import { describe, it, expect } from "vitest";
import {
  extractTicketKeys,
  correlate,
  type CorrelationSignal,
} from "./correlation";
import { DIMENSIONS } from "./coverage";
import { HEALTH_DIMENSIONS } from "./health";
import { REPORT_SECTIONS } from "./report";

describe("extractTicketKeys", () => {
  it("extrae claves tipo ABC-123", () => {
    expect(extractTicketKeys("Fix login timeout DEV-342")).toEqual(["DEV-342"]);
    expect(extractTicketKeys("feature/DEV-342-login")).toEqual(["DEV-342"]);
    expect(extractTicketKeys("sin clave")).toEqual([]);
    expect(extractTicketKeys(null)).toEqual([]);
  });

  it("no genera falsos positivos con texto en minúsculas (INT-01a)", () => {
    // "node-18" NO debe matchear como clave (antes se uppercaseaba todo).
    expect(extractTicketKeys("bump node-18 in ci")).toEqual([]);
    expect(extractTicketKeys("upgrade to python-3")).toEqual([]);
    // pero una clave real en mayúsculas dentro del mismo texto sí matchea.
    expect(extractTicketKeys("bump node-18 for DEV-123")).toEqual(["DEV-123"]);
  });

  it("filtra por prefijos conocidos cuando se pasan (opcional)", () => {
    expect(extractTicketKeys("DEV-1 y OPS-2", ["DEV"])).toEqual(["DEV-1"]);
    expect(extractTicketKeys("DEV-1 y OPS-2", ["dev", "ops"])).toEqual(["DEV-1", "OPS-2"]);
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

  it("una señal sin clave queda como grupo propio con confianza moderada (INT-01c)", () => {
    const groups = correlate([
      ...signals,
      { kind: "code_change", source: "github", externalId: "99", title: "chore: bump deps", url: "u", codeState: "OPEN" },
    ]);
    const orphan = groups.find((g) => g.key === null);
    expect(orphan).toBeDefined();
    expect(orphan!.signals[0].externalId).toBe("99");
    // Orphan NO debe tener confianza 100 (semánticamente invertido).
    expect(orphan!.confidence).toBeLessThan(60);
    expect(orphan!.confidence).toBe(40);
  });

  it("no duplica una señal en varios grupos si menciona varias keys (INT-01b)", () => {
    const groups = correlate([
      { kind: "work_item", source: "jira", externalId: "DEV-1", title: "Base", url: "u", bucket: "DONE" },
      { kind: "work_item", source: "jira", externalId: "DEV-2", title: "Otra", url: "u", bucket: "DONE" },
      // Un PR que menciona ambas: debe asignarse a UNA sola key canónica.
      { kind: "code_change", source: "github", externalId: "50", title: "Fix DEV-1 and DEV-2", url: "u", codeState: "MERGED", branch: "feature/DEV-1" },
    ]);
    const occurrences = groups.filter((g) =>
      g.signals.some((s) => s.externalId === "50"),
    ).length;
    expect(occurrences).toBe(1);
    // La key canónica del code_change proviene de su título (primera): DEV-1.
    const holder = groups.find((g) => g.signals.some((s) => s.externalId === "50"))!;
    expect(holder.key).toBe("DEV-1");
  });

  it("work_item usa el externalId como key canónica preferida", () => {
    const groups = correlate([
      { kind: "work_item", source: "jira", externalId: "DEV-9", title: "menciona OPS-3", url: "u", bucket: "DONE" },
    ]);
    const g = groups[0];
    expect(g.key).toBe("DEV-9");
  });
});

describe("B1 — guard de coverageKeys (health/report)", () => {
  it("todo coverageKey referenciado existe en DIMENSIONS", () => {
    const validKeys = new Set(DIMENSIONS.map((d) => d.key));
    const offenders: string[] = [];
    for (const def of HEALTH_DIMENSIONS) {
      for (const k of def.coverageKeys) {
        if (!validKeys.has(k)) offenders.push(`health:${def.key}:${k}`);
      }
    }
    for (const def of REPORT_SECTIONS) {
      for (const k of def.coverageKeys) {
        if (!validKeys.has(k)) offenders.push(`report:${def.key}:${k}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
