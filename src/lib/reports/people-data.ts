import { prisma } from "@/lib/prisma";
import { computeTier, type PerfTier } from "./people-profile";
import type { PersonInput } from "./matrix";
import type { PersonInsight, ReportMetrics } from "./types";
import { makeResolver, resolvePerson } from "./identity";
import { getIdentityConfig } from "./identity-store";
import { autoMergeGroups } from "./identity-suggest";
import { isPersonActive, maxIso } from "./activity";

/** Arma los datos por persona del proyecto (quant + contexto) para la matriz. */
export async function getProjectPeople(projectId: string): Promise<PersonInput[]> {
  const [reports, identityConfig] = await Promise.all([
    prisma.report.findMany({
      where: { projectId },
      orderBy: { periodEnd: "asc" },
      take: 6,
      select: { metrics: true },
    }),
    getIdentityConfig(projectId),
  ]);
  const resolve = makeResolver(identityConfig);

  // Pasada 1: identidad canónica (alias) de cada persona de cada reporte.
  const resolved: { p: PersonInsight; id: string; name: string }[] = [];
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    for (const p of m?.people ?? []) {
      const { id, name } = resolvePerson(resolve, p);
      resolved.push({ p, id: id || p.name, name: name || p.name });
    }
  }

  // Auto-merge de alta confianza sobre las identidades distintas.
  const distinct = new Map<string, string>();
  for (const r of resolved) if (!distinct.has(r.id)) distinct.set(r.id, r.name);
  const { groupId, displayName } = autoMergeGroups(
    Array.from(distinct, ([id, name]) => ({ id, name })),
  );

  // Agrupa por identidad canónica + auto-merge. Unifica personas que venían
  // separadas por app y aplica los alias definidos.
  const byPerson = new Map<
    string,
    {
      tiers: PerfTier[];
      latest: PersonInsight;
      throughputs: number[];
      displayName: string;
      rawNames: Set<string>;
      lastActivityAt: string | null;
    }
  >();
  for (const { p, id, name } of resolved) {
    const key = groupId.get(id) ?? id;
    const display = displayName.get(id) ?? name;
    const e =
      byPerson.get(key) ??
      {
        tiers: [],
        latest: p,
        throughputs: [],
        displayName: display,
        rawNames: new Set<string>(),
        lastActivityAt: null,
      };
    e.tiers.push(computeTier(p));
    e.throughputs.push(p.throughput);
    e.latest = p;
    e.displayName = display;
    e.rawNames.add(p.name);
    // La más reciente entre todos los reportes/alias de esta persona.
    e.lastActivityAt = maxIso(e.lastActivityAt, p.lastActivityAt);
    byPerson.set(key, e);
  }

  const contexts = await prisma.personContext.findMany({ where: { projectId } });
  const ctxByName = new Map(
    contexts.map((c) => [
      c.name,
      {
        role: c.role ?? "",
        seniority: c.seniority ?? "",
        daily: c.daily ?? "",
        refinement: c.refinement ?? "",
        retro: c.retro ?? "",
        demo: c.demo ?? "",
        ownership: c.ownership ?? "",
        feedback: c.feedback ?? "",
        notes: c.notes ?? "",
      } as Record<string, string>,
    ]),
  );

  const out: PersonInput[] = [];
  for (const e of byPerson.values()) {
    // Excluye a quien lleva > REPORT_INACTIVE_DAYS sin actividad (medido contra
    // hoy). Personas de reportes viejos sin dato de actividad no se filtran.
    if (!isPersonActive(e.lastActivityAt)) continue;
    const t = e.throughputs;
    const trend =
      t.length >= 2
        ? t[t.length - 1] > t[t.length - 2]
          ? "up"
          : t[t.length - 1] < t[t.length - 2]
            ? "down"
            : "flat"
        : "flat";
    // Contexto: probá por el nombre para mostrar y por cualquier handle crudo
    // que se haya fusionado (retro-compat con contextos guardados por handle).
    let context = ctxByName.get(e.displayName) ?? null;
    if (!context) {
      for (const raw of e.rawNames) {
        const c = ctxByName.get(raw);
        if (c) {
          context = c;
          break;
        }
      }
    }
    out.push({
      name: e.displayName,
      latest: e.latest,
      tiers: e.tiers,
      trend,
      context,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
