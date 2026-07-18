import { describe, it, expect } from "vitest";
import {
  classifySyncError,
  classifySyncSuccess,
  summarizeData,
  httpStatusOf,
} from "./health";
import { HttpError } from "@/lib/http";

describe("integration health classifier", () => {
  it("401 => TOKEN_EXPIRED con acción de reconectar", () => {
    const c = classifySyncError(new HttpError(401, "unauthorized"), "GitHub");
    expect(c.status).toBe("TOKEN_EXPIRED");
    expect(c.recommendedAction.toLowerCase()).toContain("reconect");
  });

  it("403 => PERMISSION_REQUIRED", () => {
    const c = classifySyncError(new HttpError(403, "forbidden"), "Jira");
    expect(c.status).toBe("PERMISSION_REQUIRED");
  });

  it("429 => RATE_LIMITED", () => {
    const c = classifySyncError(new HttpError(429, "too many"), "GitHub");
    expect(c.status).toBe("RATE_LIMITED");
  });

  it("404 => FAILED (recurso inexistente)", () => {
    const c = classifySyncError(new HttpError(404, "not found"), "Jira");
    expect(c.status).toBe("FAILED");
  });

  it("5xx => FAILED transitorio", () => {
    const c = classifySyncError(new HttpError(503, "unavailable"), "Jira");
    expect(c.status).toBe("FAILED");
  });

  it("extrae el status del texto cuando el error no es HttpError", () => {
    expect(httpStatusOf(new Error("Jira devolvió estado 401 al buscar"))).toBe(401);
    const c = classifySyncError(new Error("GitHub devolvió estado 403 al listar PRs"));
    expect(c.status).toBe("PERMISSION_REQUIRED");
  });

  it("un sync sin registros => PARTIALLY_SYNCED (no se declara sano)", () => {
    const s = summarizeData({ workItems: [] });
    const c = classifySyncSuccess(s, "Airtable");
    expect(c.status).toBe("PARTIALLY_SYNCED");
    expect(c.recommendedAction).not.toBe("");
  });

  it("un sync con registros => CONNECTED", () => {
    const s = summarizeData({
      workItems: [{ externalId: "1" } as never],
      codeChanges: [{ externalId: "2" } as never],
    });
    expect(s.recordsImported).toBe(2);
    expect(classifySyncSuccess(s).status).toBe("CONNECTED");
  });

  it("con datos pero warnings parciales (ej. CI) => PARTIALLY_SYNCED", () => {
    const s = summarizeData({ codeChanges: [{ externalId: "2" } as never] });
    const c = classifySyncSuccess(s, "GitHub", ["No se pudo traer CI/CD"]);
    expect(c.status).toBe("PARTIALLY_SYNCED");
    expect(c.lastErrorMessage).toContain("CI/CD");
  });
});
