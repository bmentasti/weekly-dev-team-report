import { describe, it, expect } from "vitest";
import { IntegrationType } from "@prisma/client";
import { PROVIDER_CATALOG, PROVIDER_LIST } from "./catalog";

// Guard: cada `type` del catálogo DEBE existir en el enum IntegrationType de
// Prisma. El código usa `entry.type as IntegrationType` en varios lugares
// (connect/data routes, loader), y ese cast oculta del typecheck cualquier
// tipo que falte en el enum — lo que en runtime rompe con
// "Invalid value for argument `type`. Expected IntegrationType.".
// Este test cierra ese hueco.
describe("catálogo de integraciones ↔ enum IntegrationType (Prisma)", () => {
  const enumValues = new Set<string>(Object.values(IntegrationType));

  it("todo provider.type es un IntegrationType válido", () => {
    const invalid = Object.values(PROVIDER_CATALOG)
      .filter((e) => !enumValues.has(e.type))
      .map((e) => `${e.slug} → ${e.type}`);
    expect(invalid, `tipos fuera del enum: ${invalid.join(", ")}`).toEqual([]);
  });

  it("no hay slugs ni types duplicados", () => {
    const slugs = PROVIDER_LIST.map((p) => p.slug);
    const types = PROVIDER_LIST.map((p) => p.type);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(types).size).toBe(types.length);
  });
});
