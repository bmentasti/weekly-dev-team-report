import { describe, it, expect } from "vitest";
import { parseConnectionBody } from "./connect-helpers";
import type { ProviderCatalogEntry } from "./catalog";

const entry = {
  fields: [
    { name: "domain", label: "Domain" },
    { name: "token", label: "Token" },
    { name: "note", label: "Nota", optional: true },
  ],
  secretField: "token",
} as unknown as ProviderCatalogEntry;

describe("parseConnectionBody", () => {
  it("separa config y secret, reporta faltantes", () => {
    const r = parseConnectionBody(entry, { domain: "acme", token: "  s3cr3t " });
    expect(r.secret).toBe("s3cr3t");
    expect(r.config).toEqual({ domain: "acme", note: "" });
    expect(r.missing).toEqual([]); // note es opcional
  });

  it("marca requeridos vacíos como faltantes", () => {
    const r = parseConnectionBody(entry, {});
    expect(r.missing).toContain("Domain");
    expect(r.missing).toContain("Token");
    expect(r.missing).not.toContain("Nota");
    expect(r.secret).toBe("");
  });
});
