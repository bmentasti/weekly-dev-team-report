import { describe, it, expect } from "vitest";
import {
  PLANS,
  annualTotal,
  integrationAllowed,
  limitLabel,
  historyCutoff,
  effectivePlan,
  isTrialActive,
  trialDaysLeft,
  ANNUAL_MONTHS,
} from "./plans";

const future = () => new Date(Date.now() + 5 * 864e5);
const past = () => new Date(Date.now() - 864e5);

describe("plans básicos", () => {
  it("annualTotal = 10 meses", () => {
    expect(annualTotal(29)).toBe(29 * ANNUAL_MONTHS);
    expect(annualTotal(0)).toBe(0);
  });
  it("limitLabel", () => {
    expect(limitLabel(null)).toBe("Ilimitado");
    expect(limitLabel(45)).toBe("45");
  });
  it("PLANS coherentes", () => {
    expect(PLANS.FREE.monthly).toBe(0);
    expect(PLANS.PRO.multiProject).toBe(true);
    expect(PLANS.FREE.maxReportsPerMonth).toBe(10);
    expect(PLANS.PRO.historyMonths).toBeNull();
  });
});

describe("integrationAllowed", () => {
  it("whitelist Jira/GitHub en todos los planes", () => {
    expect(integrationAllowed("FREE", "JIRA")).toBe(true);
    expect(integrationAllowed("FREE", "GITHUB")).toBe(true);
  });
  it("Free bloquea el resto", () => {
    expect(integrationAllowed("FREE", "SLACK")).toBe(false);
    expect(integrationAllowed("FREE", "GITLAB")).toBe(false);
  });
  it("Team permite tareas/código pero no comunicación ni IA", () => {
    expect(integrationAllowed("TEAM", "GITLAB")).toBe(true);
    expect(integrationAllowed("TEAM", "SLACK")).toBe(false);
    expect(integrationAllowed("TEAM", "ANTHROPIC")).toBe(false);
  });
  it("Pro permite comunicación e IA", () => {
    expect(integrationAllowed("PRO", "SLACK")).toBe(true);
    expect(integrationAllowed("PRO", "ANTHROPIC")).toBe(true);
  });
  it("tipo desconocido (sin provider) => false aunque el plan sea Pro", () => {
    expect(integrationAllowed("PRO", "TIPO_INEXISTENTE" as never)).toBe(false);
  });
});

describe("historyCutoff", () => {
  it("Pro = sin límite", () => {
    expect(historyCutoff("PRO")).toBeNull();
  });
  it("Free/Team devuelven fecha en el pasado", () => {
    const free = historyCutoff("FREE");
    const team = historyCutoff("TEAM");
    expect(free).toBeInstanceOf(Date);
    expect(team).toBeInstanceOf(Date);
    expect((free as Date).getTime()).toBeLessThan(Date.now());
    // Team conserva más histórico que Free
    expect((team as Date).getTime()).toBeLessThan((free as Date).getTime());
  });
});

describe("reverse trial", () => {
  it("trial activo => plan efectivo PRO", () => {
    const ws = { plan: "FREE", trialEndsAt: future() };
    expect(isTrialActive(ws)).toBe(true);
    expect(effectivePlan(ws)).toBe("PRO");
    expect(trialDaysLeft(ws)).toBeGreaterThan(0);
  });
  it("trial vencido => plan real", () => {
    const ws = { plan: "FREE", trialEndsAt: past() };
    expect(isTrialActive(ws)).toBe(false);
    expect(effectivePlan(ws)).toBe("FREE");
    expect(trialDaysLeft(ws)).toBe(0);
  });
  it("sin trial => plan real / FREE por defecto", () => {
    expect(effectivePlan({ plan: "TEAM" })).toBe("TEAM");
    expect(effectivePlan(null)).toBe("FREE");
    expect(isTrialActive(null)).toBe(false);
    expect(trialDaysLeft(undefined)).toBe(0);
  });
});
