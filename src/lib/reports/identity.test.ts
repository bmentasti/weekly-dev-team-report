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

  it("el ID ESTABLE del proveedor tiene prioridad y sobrevive un cambio de username", () => {
    const r = makeResolver({
      identities: [{ key: "person-1", displayName: "Ana Díaz" }],
      aliases: [
        {
          source: "github",
          handle: "12345", // handle = id estable
          canonicalId: "person-1",
          displayName: "Ana Díaz",
          externalUserId: "12345",
          matchMethod: "provider_id",
          verified: true,
        },
      ],
    });
    // El username cambió (anadiaz → ana-d) pero el id estable NO. Debe resolver igual.
    const before = r({ source: "github", handle: "anadiaz", externalUserId: "12345" });
    const after = r({ source: "github", handle: "ana-d", externalUserId: "12345" });
    expect(before.id).toBe("person-1");
    expect(after.id).toBe("person-1");
    expect(after.matchMethod).toBe("provider_id");
  });

  it("una sugerencia SIN confirmar (verified=false) NO se auto-vincula", () => {
    const r = makeResolver({
      identities: [{ key: "person-1", displayName: "Ana Díaz" }],
      aliases: [
        {
          source: "github",
          handle: "ana.d",
          canonicalId: "person-1",
          displayName: "Ana Díaz",
          matchMethod: "suggested",
          confidence: 0.7,
          verified: false, // pendiente de confirmación
        },
      ],
    });
    // Como la sugerencia no está confirmada, "ana.d" resuelve a su propio id,
    // NO a person-1.
    const hit = r({ source: "github", handle: "ana.d" });
    expect(hit.id).not.toBe("person-1");
    expect(hit.id).toBe("ana.d");
  });

  it("una sugerencia YA confirmada (verified=true) sí vincula", () => {
    const r = makeResolver({
      identities: [{ key: "person-1", displayName: "Ana Díaz" }],
      aliases: [
        {
          source: "github",
          handle: "ana.d",
          canonicalId: "person-1",
          displayName: "Ana Díaz",
          matchMethod: "suggested",
          confidence: 0.7,
          verified: true,
        },
      ],
    });
    expect(r({ source: "github", handle: "ana.d" }).id).toBe("person-1");
  });

  it("resuelve por email alternativo declarado como alias", () => {
    const r = makeResolver({
      identities: [{ key: "person-1", displayName: "Ana Díaz" }],
      aliases: [
        {
          source: "*",
          handle: "email:ana.personal@gmail.com",
          canonicalId: "person-1",
          displayName: "Ana Díaz",
          matchMethod: "email_alias",
          verified: true,
        },
      ],
    });
    const hit = r({ source: "jira", handle: "whatever", email: "ana.personal@gmail.com" });
    expect(hit.id).toBe("person-1");
  });

  it("expone matchMethod=email_exact al resolver por email universal", () => {
    const r = makeResolver({ identities: [], aliases: [] });
    const hit = r({ source: "jira", handle: "ana", email: "ana@acme.com" });
    expect(hit.matchMethod).toBe("email_exact");
  });
});
