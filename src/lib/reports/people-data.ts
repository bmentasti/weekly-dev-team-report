import { prisma } from "@/lib/prisma";
import { computeTier, type PerfTier } from "./people-profile";
import type { PersonInput } from "./matrix";
import type { PersonInsight, ReportMetrics } from "./types";
import { makeResolver } from "./identity";
import { getIdentityConfig } from "./identity-store";

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

  // Agrupa por identidad canónica (id ?? name resuelto). Esto unifica personas
  // que en reportes viejos venían separadas y aplica los alias definidos.
  const byPerson = new Map<
    string,
    {
      tiers: PerfTier[];
      latest: PersonInsight;
      throughputs: number[];
      displayName: string;
      rawNames: Set<string>;
    }
  >();
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    for (const p of m?.people ?? []) {
      const { id, name } = resolve({ source: null, handle: p.id ?? p.name });
      const key = id || p.name;
      const e =
        byPerson.get(key) ??
        {
          tiers: [],
          latest: p,
          throughputs: [],
          displayName: name || p.name,
          rawNames: new Set<string>(),
        };
      e.tiers.push(computeTier(p));
      e.throughputs.push(p.throughput);
      e.latest = p;
      e.displayName = name || p.name;
      e.rawNames.add(p.name);
      byPerson.set(key, e);
    }
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
