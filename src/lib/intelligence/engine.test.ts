import { describe, it, expect } from "vitest";
import { computeCoverage } from "./coverage";
import { computeHealth } from "./health";
import { generateRecommendations } from "./recommendations";
import { buildAdaptiveReport } from "./report";
import type { ConnectedSource } from "./types";

const NOW = new Date("2026-07-10T12:00:00Z");
const src = (slug: string, label: string): ConnectedSource => ({
  slug,
  label,
  status: "CONNECTED",
  lastSyncAt: new Date("2026-07-10T06:00:00Z"),
});

const jira = computeCoverage([src("jira", "Jira")], NOW);
const jiraGithub = computeCoverage([src("jira", "Jira"), src("github", "GitHub")], NOW);

describe("Health Score (Etapa 3)", () => {
  it("sin datos → overall null y todas las dimensiones insuficientes", () => {
    const h = computeHealth(computeCoverage([], NOW));
    expect(h.overall).toBeNull();
    expect(h.dimensions.every((d) => d.status === "insufficient")).toBe(true);
  });

  it("con Jira+GitHub: code tiene score, security insuficiente, overall numérico", () => {
    const h = computeHealth(jiraGithub);
    expect(h.overall).not.toBeNull();
    const code = h.dimensions.find((d) => d.key === "code")!;
    const security = h.dimensions.find((d) => d.key === "security")!;
    expect(code.score).toBeGreaterThan(0);
    expect(security.status).toBe("insufficient");
    expect(security.score).toBeNull();
  });

  it("el perfil cambia los pesos (bank prioriza seguridad/calidad)", () => {
    expect(computeHealth(jiraGithub, "bank").profile).toBe("bank");
    // ambas configuraciones producen overall válido
    expect(computeHealth(jiraGithub, "startup").overall).not.toBeNull();
  });
});

describe("Recomendaciones (Etapa 3)", () => {
  it("recomienda integraciones para dimensiones sin datos, priorizadas", () => {
    const recs = generateRecommendations(jira);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some((r) => r.title.includes("SonarQube"))).toBe(true);
    expect(recs[0].priority).toBe("high"); // ordenadas por prioridad
    expect(recs.every((r) => r.confidence > 0 && r.status === "NEW")).toBe(true);
  });
});

describe("Informe adaptativo (Etapa 3)", () => {
  it("solo Jira: planning con datos, code/quality sin datos", () => {
    const { sections } = buildAdaptiveReport(jira);
    const planning = sections.find((s) => s.key === "planning")!;
    const code = sections.find((s) => s.key === "code")!;
    const quality = sections.find((s) => s.key === "quality")!;
    expect(planning.state).not.toBe("NO_DATA");
    expect(code.state).toBe("NO_DATA");
    expect(quality.state).toBe("NO_DATA");
  });

  it("Jira+GitHub: la sección Code pasa a tener datos", () => {
    const { sections } = buildAdaptiveReport(jiraGithub);
    const code = sections.find((s) => s.key === "code")!;
    expect(code.state).not.toBe("NO_DATA");
    expect(code.coverage).toBeGreaterThan(0);
  });
});
