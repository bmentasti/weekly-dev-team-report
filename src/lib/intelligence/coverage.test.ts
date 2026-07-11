import { describe, it, expect } from "vitest";
import { computeCoverage, coverageForDimension, DIMENSIONS } from "./coverage";
import type { ConnectedSource } from "./types";

const NOW = new Date("2026-07-10T12:00:00Z");
const fresh = (slug: string, label: string): ConnectedSource => ({
  slug,
  label,
  status: "CONNECTED",
  lastSyncAt: new Date("2026-07-10T00:00:00Z"), // ~0.5 días
});

function dim(report: ReturnType<typeof computeCoverage>, key: string) {
  const d = report.dimensions.find((x) => x.key === key);
  if (!d) throw new Error(`dimensión ${key} no existe`);
  return d;
}

describe("Data Coverage Model", () => {
  it("sin integraciones: todo en 0 e Insuficiente", () => {
    const r = computeCoverage([], NOW);
    expect(r.overall).toBe(0);
    expect(r.level).toBe("INSUFICIENTE");
    expect(r.categoriesCovered).toBe(0);
    expect(r.dimensions.every((d) => d.coverage === 0)).toBe(true);
  });

  it("solo Jira: cubre tareas/planificación pero no código ni calidad", () => {
    const r = computeCoverage([fresh("jira", "Jira")], NOW);
    expect(dim(r, "tasks").coverage).toBeGreaterThanOrEqual(65);
    expect(dim(r, "planning").coverage).toBeGreaterThan(0);
    expect(dim(r, "code").coverage).toBe(0);
    expect(dim(r, "quality").coverage).toBe(0);
    // recomienda integraciones para lo que falta
    expect(dim(r, "quality").recommended).toContain("SonarQube");
    expect(dim(r, "code").confidence).toBe("INSUFICIENTE");
  });

  it("Jira + GitHub: agrega código y pull requests", () => {
    const r = computeCoverage([fresh("jira", "Jira"), fresh("github", "GitHub")], NOW);
    expect(dim(r, "code").coverage).toBeGreaterThan(0);
    expect(dim(r, "pull_requests").coverage).toBeGreaterThan(0);
    expect(dim(r, "code").sources).toContain("GitHub");
  });

  it("más fuentes suben la cobertura global (redundancia)", () => {
    const one = computeCoverage([fresh("jira", "Jira")], NOW).overall;
    const many = computeCoverage(
      [fresh("jira", "Jira"), fresh("github", "GitHub"), fresh("slack", "Slack")],
      NOW,
    ).overall;
    expect(many).toBeGreaterThan(one);
  });

  it("datos viejos reducen la cobertura de la dimensión", () => {
    const stale: ConnectedSource = {
      slug: "jira",
      label: "Jira",
      status: "CONNECTED",
      lastSyncAt: new Date("2026-07-01T00:00:00Z"), // ~9 días
    };
    const freshCov = coverageForDimension(DIMENSIONS.find((d) => d.key === "tasks")!, [fresh("jira", "Jira")], NOW).coverage;
    const staleCov = coverageForDimension(DIMENSIONS.find((d) => d.key === "tasks")!, [stale], NOW).coverage;
    expect(staleCov).toBeLessThan(freshCov);
  });

  it("una integración en ERROR no cuenta como fuente", () => {
    const errored: ConnectedSource = {
      slug: "jira",
      label: "Jira",
      status: "ERROR",
      lastSyncAt: NOW,
    };
    expect(dim(computeCoverage([errored], NOW), "tasks").coverage).toBe(0);
  });
});
