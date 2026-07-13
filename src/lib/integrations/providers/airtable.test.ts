import { describe, it, expect } from "vitest";
import { resolveAssignee } from "./airtable";

// Mapa record id -> nombre real (como el que arma fetchData leyendo la tabla
// de personas vinculada).
const nameById = new Map<string, string>([
  ["recAmn3IscQ6lE7Dl", "Gonzalo Ávalos"],
  ["recXYZ1234567890ab", "Ana Ruiz"],
]);

describe("airtable resolveAssignee", () => {
  it("resuelve un registro vinculado (record id) al nombre real", () => {
    expect(resolveAssignee(["recAmn3IscQ6lE7Dl"], nameById)).toBe("Gonzalo Ávalos");
  });

  it("resuelve un record id pasado como string suelto", () => {
    expect(resolveAssignee("recAmn3IscQ6lE7Dl", nameById)).toBe("Gonzalo Ávalos");
  });

  it("resuelve múltiples responsables vinculados", () => {
    expect(
      resolveAssignee(["recAmn3IscQ6lE7Dl", "recXYZ1234567890ab"], nameById),
    ).toBe("Gonzalo Ávalos, Ana Ruiz");
  });

  it("deduplica cuando el mismo registro aparece repetido", () => {
    expect(
      resolveAssignee(["recAmn3IscQ6lE7Dl", "recAmn3IscQ6lE7Dl"], nameById),
    ).toBe("Gonzalo Ávalos");
  });

  it("mantiene el record id si no está en el mapa (la capa de identidad lo unifica)", () => {
    expect(resolveAssignee("recUNKNOWN00000000", nameById)).toBe("recUNKNOWN00000000");
    expect(resolveAssignee(["recAmn3IscQ6lE7Dl"], new Map())).toBe("recAmn3IscQ6lE7Dl");
  });

  it("resuelve colaboradores (objetos con name/email)", () => {
    expect(resolveAssignee([{ name: "Bruno M" }], nameById)).toBe("Bruno M");
    expect(resolveAssignee([{ email: "bruno@acme.com" }], nameById)).toBe(
      "bruno@acme.com",
    );
  });

  it("pasa strings comunes tal cual", () => {
    expect(resolveAssignee("plainuser", nameById)).toBe("plainuser");
  });

  it("devuelve null para vacío o nulo", () => {
    expect(resolveAssignee("", nameById)).toBeNull();
    expect(resolveAssignee(null, nameById)).toBeNull();
    expect(resolveAssignee([], nameById)).toBeNull();
  });
});
