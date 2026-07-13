import { describe, it, expect } from "vitest";
import { makeResolver, normalizeHandle } from "./identity";

describe("identity resolver", () => {
  it("normaliza handles (trim, @, mayúsculas)", () => {
    expect(normalizeHandle("  @GonzaloAvalos29 ")).toBe("gonzaloavalos29");
  });

  it("mismo handle en distintas apps => mismo ID (auto-merge)", () => {
    const r = makeResolver({ identities: [], aliases: [] });
    const gh = r({ source: "github", handle: "gonzaloAvalos29" });
    const other = r({ source: "linear", handle: "@gonzaloavalos29" });
    expect(gh.id).toBe(other.id);
    expect(gh.id).toBe("gonzaloavalos29");
  });

  it("emails se namespacean y no colisionan con logins", () => {
    const r = makeResolver({ identities: [], aliases: [] });
    expect(r({ source: null, handle: "ana@acme.com" }).id).toBe("email:ana@acme.com");
    expect(r({ source: "github", handle: "ana" }).id).toBe("ana");
  });

  it("IDs opacos (record ids) se namespacean (source-independiente) y NO se confunden con nombres", () => {
    const r = makeResolver({ identities: [], aliases: [] });
    const at = r({ source: "airtable", handle: "recAmn3IscQ6lE7Dl" });
    expect(at.id).toBe("rec:recamn3iscq6le7dl");
    // El MISMO record id da el MISMO ID canónico aunque se lea sin saber la app
    // (así se alinean reportes viejos y nuevos).
    const readBack = r({ source: null, handle: "recAmn3IscQ6lE7Dl" });
    expect(readBack.id).toBe(at.id);
  });

  it("alias fusiona un record id de Airtable con el login de GitHub", () => {
    const r = makeResolver({
      identities: [{ key: "gonzaloavalos29", displayName: "Gonzalo Ávalos" }],
      aliases: [
        {
          source: "airtable",
          handle: "recAmn3IscQ6lE7Dl",
          canonicalId: "gonzaloavalos29",
          displayName: "Gonzalo Ávalos",
        },
      ],
    });
    const gh = r({ source: "github", handle: "gonzaloavalos29" });
    const at = r({ source: "airtable", handle: "recAmn3IscQ6lE7Dl" });
    expect(at.id).toBe("gonzaloavalos29");
    expect(gh.id).toBe("gonzaloavalos29");
    expect(gh.id).toBe(at.id);
    expect(at.name).toBe("Gonzalo Ávalos");
    expect(gh.name).toBe("Gonzalo Ávalos");
  });

  it("resuelve el ID canónico namespaced ya guardado (retro-compat de reportes)", () => {
    // Un reporte viejo guardó p.id = 'airtable:recamn3iscq6le7dl'. Tras crear el
    // alias sobre el handle crudo, ese ID persistido debe seguir mapeando bien.
    const r = makeResolver({
      identities: [{ key: "gonzaloavalos29", displayName: "Gonzalo Ávalos" }],
      aliases: [
        {
          source: "airtable",
          handle: "recAmn3IscQ6lE7Dl",
          canonicalId: "gonzaloavalos29",
          displayName: "Gonzalo Ávalos",
        },
      ],
    });
    const stored = r({ source: null, handle: "rec:recamn3iscq6le7dl" });
    expect(stored.id).toBe("gonzaloavalos29");
  });

  it("handle vacío => id vacío (se ignora aguas arriba)", () => {
    const r = makeResolver({ identities: [], aliases: [] });
    expect(r({ source: "github", handle: "  " }).id).toBe("");
  });

  it("EMAIL es la clave universal: mismo email en apps distintas => misma identidad", () => {
    const r = makeResolver({ identities: [], aliases: [] });
    const a = r({ source: "airtable", handle: "Gonzalo Ávalos", email: "gonza@acme.com" });
    const b = r({ source: "jira", handle: "gonzalo.avalos", email: "GONZA@acme.com" });
    expect(a.id).toBe("email:gonza@acme.com");
    expect(a.id).toBe(b.id);
    // El nombre a mostrar es el humano, no el email.
    expect(a.name).toBe("Gonzalo Ávalos");
  });

  it("el email tiene prioridad sobre el nombre para agrupar", () => {
    const r = makeResolver({ identities: [], aliases: [] });
    // Mismo nombre pero DISTINTO email => personas distintas (homónimos).
    const a = r({ source: "airtable", handle: "Juan Pérez", email: "juan1@acme.com" });
    const b = r({ source: "jira", handle: "Juan Pérez", email: "juan2@acme.com" });
    expect(a.id).not.toBe(b.id);
  });
});
