import { describe, it, expect } from "vitest";
import {
  personMatchesKey,
  canonicalIdOf,
  buildIntegrationAccounts,
  primaryEmailOf,
  selectParticipant,
} from "./participant-detail";
import { makeResolver } from "./identity";
import type { AliasRecord } from "./identity";
import type { PersonInsight } from "./types";

function person(id: string | undefined, name: string, extra: Partial<PersonInsight> = {}): PersonInsight {
  return {
    id,
    name,
    tasksDone: 0,
    tasksInProgress: 0,
    tasksBlocked: 0,
    tasksStale: 0,
    prsOpen: 0,
    prsMerged: 0,
    committedPoints: 0,
    completedPoints: 0,
    wip: 0,
    throughput: 0,
    cycleTimeAvgDays: null,
    category: "ON_TRACK",
    score: 0,
    rank: 0,
    nextStep: "",
    ...extra,
  };
}

describe("participant-detail selección estable", () => {
  const resolve = makeResolver({ identities: [], aliases: [] });

  it("matchea por id canónico, no por índice", () => {
    const p = person("email:ana@acme.com", "Ana Díaz");
    expect(personMatchesKey(p, "email:ana@acme.com", resolve)).toBe(true);
    expect(personMatchesKey(p, "otra-clave", resolve)).toBe(false);
  });

  it("dos homónimos NO colisionan cuando se navega por id", () => {
    const juan1 = person("email:juan1@acme.com", "Juan Pérez");
    const juan2 = person("email:juan2@acme.com", "Juan Pérez");
    // Navegando por id, cada uno matchea solo su propia clave.
    expect(personMatchesKey(juan1, "email:juan1@acme.com", resolve)).toBe(true);
    expect(personMatchesKey(juan2, "email:juan1@acme.com", resolve)).toBe(false);
  });

  it("retro-compat: matchea por nombre visible si el key es un nombre", () => {
    const p = person(undefined, "Maximo Marzetti");
    expect(personMatchesKey(p, "Maximo Marzetti", resolve)).toBe(true);
  });

  it("selectParticipant agrupa las filas del mismo participante por id", () => {
    const reports = [
      { periodEnd: new Date("2026-07-01"), people: [person("gonzalo", "Gonzalo"), person("ana", "Ana")] },
      { periodEnd: new Date("2026-07-08"), people: [person("gonzalo", "Gonzalo")] },
    ];
    const sel = selectParticipant(reports, "gonzalo", resolve);
    expect(sel.participantId).toBe("gonzalo");
    expect(sel.matches).toHaveLength(2);
  });

  it("canonicalIdOf usa el nombre si no hay id", () => {
    expect(canonicalIdOf(person(undefined, "Solo Nombre"), resolve)).toBe("Solo Nombre");
  });
});

describe("participant-detail procedencia", () => {
  const aliases: AliasRecord[] = [
    {
      source: "github",
      handle: "12345",
      canonicalId: "email:ana@acme.com",
      displayName: "Ana",
      externalUserId: "12345",
      matchMethod: "provider_id",
      verified: true,
    },
    {
      source: "*",
      handle: "otra-persona",
      canonicalId: "email:otra@acme.com",
      displayName: "Otra",
      matchMethod: "manual",
      verified: true,
    },
  ];

  it("buildIntegrationAccounts solo incluye las cuentas del participante", () => {
    const accounts = buildIntegrationAccounts(aliases, "email:ana@acme.com");
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      provider: "github",
      externalUserId: "12345",
      mappingSource: "provider-id",
      verified: true,
    });
  });

  it("primaryEmailOf deriva el email del id canónico email:", () => {
    expect(primaryEmailOf("email:ana@acme.com", aliases)).toBe("ana@acme.com");
    expect(primaryEmailOf("gonzalo", aliases)).toBeNull();
  });
});
