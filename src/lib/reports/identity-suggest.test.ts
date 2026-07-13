import { describe, it, expect } from "vitest";
import { suggestMerges } from "./identity-suggest";

const group = (s: ReturnType<typeof suggestMerges>, ids: string[]) =>
  s.find((g) => ids.every((id) => g.ids.includes(id)));

describe("suggestMerges", () => {
  const people = [
    { id: "aghosteada", name: "aghosteada" },
    { id: "gonzaloavalos29", name: "gonzaloavalos29" },
    { id: "rec:recamn3iscq6le7dl", name: "Gonzalo Ávalos" },
    { id: "eduardoemanuelcf", name: "eduardoemanuelcf" },
    { id: "eduardo-emanuel", name: "Eduardo Emanuel" },
    { id: "mar-ilyn", name: "mar-ilyn" },
    { id: "marilyn", name: "Marilyn" },
    { id: "marielgutierrez", name: "marielgutierrez" },
    { id: "rec:recxyz1234567890", name: "recXYZ1234567890ab" },
    { id: "kevinalexis7", name: "kevinalexis7" },
  ];
  const s = suggestMerges(people);

  it("cruza el login de GitHub con el nombre real de Airtable", () => {
    const g = group(s, ["gonzaloavalos29", "rec:recamn3iscq6le7dl"]);
    expect(g).toBeTruthy();
    expect(g!.displayName).toBe("Gonzalo Ávalos");
    expect(g!.confidence).toBe("alta");
  });

  it("agrupa variantes de nombre (handle vs nombre.apellido)", () => {
    expect(group(s, ["eduardoemanuelcf", "eduardo-emanuel"])).toBeTruthy();
    expect(group(s, ["mar-ilyn", "marilyn"])).toBeTruthy();
  });

  it("no genera falsos positivos", () => {
    expect(group(s, ["marielgutierrez", "marilyn"])).toBeFalsy();
    expect(s.some((g) => g.ids.includes("aghosteada"))).toBe(false);
    expect(s.some((g) => g.ids.includes("kevinalexis7"))).toBe(false);
  });

  it("ignora record ids opacos sin nombre resoluble", () => {
    expect(s.some((g) => g.ids.includes("rec:recxyz1234567890"))).toBe(false);
  });

  it("elige el nombre más humano como displayName", () => {
    const g = group(s, ["eduardoemanuelcf", "eduardo-emanuel"]);
    expect(g!.displayName).toBe("Eduardo Emanuel");
  });

  it("sin personas no sugiere nada", () => {
    expect(suggestMerges([])).toEqual([]);
  });
});
