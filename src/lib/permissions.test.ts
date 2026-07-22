import { describe, it, expect } from "vitest";
import { can, ROLE_LABEL, type AccessRole, type Capability } from "./permissions";

describe("permissions", () => {
  it("Owner puede todo lo sensible", () => {
    for (const c of [
      "viewPeople",
      "editStandards",
      "connectIntegrations",
      "viewAudit",
      "inviteUsers",
      "manageRoles",
      "changePlan",
      "deleteWorkspace",
    ] as Capability[]) {
      expect(can("OWNER", c)).toBe(true);
    }
  });

  it("Admin gestiona pero no facturación ni borrar workspace", () => {
    expect(can("ADMIN", "manageRoles")).toBe(true);
    expect(can("ADMIN", "changePlan")).toBe(false);
    expect(can("ADMIN", "deleteWorkspace")).toBe(false);
  });

  it("Member: genera y ve personas, pero no gestiona ni integra", () => {
    expect(can("MEMBER", "generateReports")).toBe(true);
    expect(can("MEMBER", "viewPeople")).toBe(true);
    expect(can("MEMBER", "connectIntegrations")).toBe(false);
    expect(can("MEMBER", "manageRoles")).toBe(false);
  });

  it("Viewer: solo ver reportes, sin datos por persona ni edición", () => {
    expect(can("VIEWER", "viewReports")).toBe(true);
    expect(can("VIEWER", "viewPeople")).toBe(false);
    expect(can("VIEWER", "editReport")).toBe(false);
    expect(can("VIEWER", "generateReports")).toBe(false);
  });

  it("rol nulo/indefinido no puede nada", () => {
    expect(can(null, "viewReports")).toBe(false);
    expect(can(undefined, "viewReports")).toBe(false);
  });

  it("rol desconocido (no está en la matriz) => false", () => {
    expect(can("SUPERUSER" as AccessRole, "viewReports")).toBe(false);
  });

  it("Finanzas: Owner/Admin ven márgenes y editan; Member sólo vista operativa", () => {
    expect(can("OWNER", "viewMargins")).toBe(true);
    expect(can("OWNER", "editFinancials")).toBe(true);
    expect(can("ADMIN", "approveBudget")).toBe(true);
    expect(can("ADMIN", "viewMargins")).toBe(true);
    // Member: ve el módulo pero NO márgenes/tarifas ni edición.
    expect(can("MEMBER", "viewFinancials")).toBe(true);
    expect(can("MEMBER", "viewMargins")).toBe(false);
    expect(can("MEMBER", "editFinancials")).toBe(false);
    expect(can("MEMBER", "approveBudget")).toBe(false);
    // Viewer: sin acceso financiero.
    expect(can("VIEWER", "viewFinancials")).toBe(false);
    expect(can("VIEWER", "viewMargins")).toBe(false);
  });

  it("ROLE_LABEL cubre los 4 roles", () => {
    for (const r of ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as AccessRole[]) {
      expect(ROLE_LABEL[r]).toBeTruthy();
    }
  });
});
