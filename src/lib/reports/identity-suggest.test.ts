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

describe("suggestMerges — handle pegado vs nombre completo (con segundo nombre)", () => {
  const people = [
    { id: "gonzaloavalos29", name: "gonzaloavalos29" },
    { id: "jira:1", name: "Gonzalo Matias Avalos" },
    { id: "eduardoemanuelcf", name: "eduardoemanuelcf" },
    { id: "jira:2", name: "Eduardo Emanuel Cabral" },
    { id: "marielgutierrez", name: "marielgutierrez" },
    { id: "jira:3", name: "Mariel Gutierrez" },
    { id: "aghosteada", name: "aghosteada" },
    { id: "jira:4", name: "Agostina de Yurka" },
    { id: "kevinalexis7", name: "kevinalexis7" },
    { id: "jira:5", name: "Brisa Abigail Ibarra" },
  ];
  const s = suggestMerges(people);

  it("une el login de GitHub con el nombre completo aunque tenga segundo nombre", () => {
    const g = group(s, ["gonzaloavalos29", "jira:1"]);
    expect(g).toBeTruthy();
    expect(g!.confidence).toBe("alta");
    expect(g!.displayName).toBe("Gonzalo Matias Avalos");
  });

  it("une con apellido abreviado en el handle", () => {
    const g = group(s, ["eduardoemanuelcf", "jira:2"]);
    expect(g).toBeTruthy();
    expect(g!.displayName).toBe("Eduardo Emanuel Cabral");
  });

  it("une handle sin dígitos con nombre y apellido", () => {
    expect(group(s, ["marielgutierrez", "jira:3"])).toBeTruthy();
  });

  it("no fusiona handles que no coinciden con ningún nombre", () => {
    // "aghosteada" no empieza por "agostina"; "kevinalexis7" y "Brisa..." no comparten raíz.
    expect(
      s.some((g) => g.ids.includes("aghosteada") && g.ids.includes("jira:4")),
    ).toBe(false);
    expect(s.some((g) => g.ids.includes("kevinalexis7"))).toBe(false);
  });
});
