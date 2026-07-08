import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  planChangeSchema,
  checkoutSchema,
  reportPatchSchema,
  standardConfigSchema,
  alertRuleSchema,
  memberInviteSchema,
  memberRoleSchema,
  createWorkspaceSchema,
  jiraConnectSchema,
  githubConnectSchema,
  userRoleLabels,
  userRoles,
} from "./validations";

describe("validations", () => {
  it("registerSchema exige password >= 8 y email válido", () => {
    expect(registerSchema.safeParse({ name: "Ana", email: "a@b.co", password: "12345678" }).success).toBe(true);
    expect(registerSchema.safeParse({ name: "Ana", email: "no-mail", password: "x" }).success).toBe(false);
  });
  it("loginSchema", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
  it("planChange / checkout con defaults de period", () => {
    expect(planChangeSchema.parse({ plan: "PRO" }).period).toBe("MONTHLY");
    expect(checkoutSchema.parse({ plan: "TEAM", period: "ANNUAL" }).period).toBe("ANNUAL");
    expect(planChangeSchema.safeParse({ plan: "X" }).success).toBe(false);
  });
  it("reportPatch acepta parciales", () => {
    expect(reportPatchSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(reportPatchSchema.safeParse({ tags: ["a", "b"] }).success).toBe(true);
  });
  it("standardConfig con scope y thresholds", () => {
    const r = standardConfigSchema.parse({ scope: "project", config: { thresholds: { bugs: { healthy: 2, risk: 5 } } } });
    expect(r.scope).toBe("project");
  });
  it("alertRule valida operador/severidad", () => {
    expect(alertRuleSchema.parse({ metricKey: "bugs", operator: "gt", threshold: 8 }).severity).toBe("medium");
    expect(alertRuleSchema.safeParse({ metricKey: "bugs", operator: "??", threshold: 1 }).success).toBe(false);
  });
  it("miembros: invite/role", () => {
    expect(memberInviteSchema.parse({ email: "a@b.co" }).role).toBe("MEMBER");
    expect(memberRoleSchema.safeParse({ userId: "u1", role: "VIEWER" }).success).toBe(true);
    expect(memberRoleSchema.safeParse({ userId: "u1", role: "OWNER" }).success).toBe(false);
  });
  it("workspace / conexiones", () => {
    expect(createWorkspaceSchema.safeParse({ name: "WS" }).success).toBe(true);
    expect(jiraConnectSchema.safeParse({ domain: "d.atlassian.net", email: "a@b.co", apiToken: "t", projectKey: "DEV" }).success).toBe(true);
    expect(githubConnectSchema.safeParse({ owner: "org", repo: "repo", accessToken: "t" }).success).toBe(true);
  });
  it("catálogo de roles funcionales", () => {
    expect(userRoles.length).toBeGreaterThan(0);
    expect(userRoleLabels.TECH_LEAD).toBe("Tech Lead");
  });
});
