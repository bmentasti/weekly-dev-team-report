import { describe, it, expect } from "vitest";
import {
  matches,
  evaluateAlertRules,
  ruleText,
  OPERATOR_LABEL,
  SEVERITY_LABEL,
  type AlertRule,
} from "./alert-rules";
import type { ReportMetrics } from "./types";

const metrics = {
  quality: { bugsOpen: 12 },
  projectProgress: { completionByPoints: 60 },
  workItems: { blocked: 3 },
} as unknown as ReportMetrics;

describe("matches", () => {
  it("operadores", () => {
    expect(matches("gt", 5, 3)).toBe(true);
    expect(matches("gt", 3, 5)).toBe(false);
    expect(matches("lt", 3, 5)).toBe(true);
    expect(matches("gte", 5, 5)).toBe(true);
    expect(matches("lte", 5, 5)).toBe(true);
    expect(matches("lte", 6, 5)).toBe(false);
  });
});

describe("evaluateAlertRules", () => {
  const rules: AlertRule[] = [
    { id: "1", metricKey: "bugs", operator: "gt", threshold: 8, severity: "high", enabled: true },
    { id: "2", metricKey: "completionRate", operator: "lt", threshold: 70, severity: "medium", enabled: true },
    { id: "3", metricKey: "blocked", operator: "gt", threshold: 5, severity: "low", enabled: true },
    { id: "4", metricKey: "coverage", operator: "lt", threshold: 80, severity: "low", enabled: true },
    { id: "5", metricKey: "bugs", operator: "gt", threshold: 1, severity: "low", enabled: false },
  ];
  const ev = evaluateAlertRules(rules, metrics);

  it("ignora reglas deshabilitadas", () => {
    expect(ev.find((e) => e.rule.id === "5")).toBeUndefined();
  });
  it("dispara bugs>8 y completion<70", () => {
    expect(ev.find((e) => e.rule.id === "1")?.triggered).toBe(true);
    expect(ev.find((e) => e.rule.id === "2")?.triggered).toBe(true);
  });
  it("no dispara blocked>5 (valor 3)", () => {
    expect(ev.find((e) => e.rule.id === "3")?.triggered).toBe(false);
  });
  it("métrica sin datos (coverage) => value null, no dispara", () => {
    const c = ev.find((e) => e.rule.id === "4");
    expect(c?.value).toBeNull();
    expect(c?.triggered).toBe(false);
  });
  it("sin métricas => value null", () => {
    const r = evaluateAlertRules([rules[0]], null);
    expect(r[0].value).toBeNull();
    expect(r[0].triggered).toBe(false);
  });
  it("metricKey desconocido => label cae a la key, unit vacío, no dispara", () => {
    const r = evaluateAlertRules(
      [{ id: "x", metricKey: "zzz_desconocida", operator: "gt", threshold: 0, severity: "low", enabled: true }],
      metrics,
    );
    expect(r[0].metricLabel).toBe("zzz_desconocida");
    expect(r[0].unit).toBe("");
    expect(r[0].value).toBeNull();
    expect(r[0].triggered).toBe(false);
  });
});

describe("ruleText / labels", () => {
  it("texto legible", () => {
    expect(ruleText({ metricKey: "bugs", operator: "gt", threshold: 8, severity: "high" })).toContain("mayor que 8");
    // métrica desconocida usa la key (sin unidad)
    expect(ruleText({ metricKey: "zzz", operator: "lt", threshold: 1, severity: "low" })).toContain("zzz");
    // métrica con unidad => la incluye (rama true de def?.unit)
    expect(ruleText({ metricKey: "completionRate", operator: "lt", threshold: 70, severity: "medium" })).toContain("%");
  });
  it("labels de operador y severidad", () => {
    expect(OPERATOR_LABEL.gte).toBeTruthy();
    expect(SEVERITY_LABEL.high).toBe("Alta");
  });
});
