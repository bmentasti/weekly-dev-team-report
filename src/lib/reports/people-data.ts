import { prisma } from "@/lib/prisma";
import { computeTier, type PerfTier } from "./people-profile";
import type { PersonInput } from "./matrix";
import type { PersonInsight, ReportMetrics } from "./types";

/** Arma los datos por persona del proyecto (quant + contexto) para la matriz. */
export async function getProjectPeople(projectId: string): Promise<PersonInput[]> {
  const reports = await prisma.report.findMany({
    where: { projectId },
    orderBy: { periodEnd: "asc" },
    take: 6,
    select: { metrics: true },
  });

  const byPerson = new Map<
    string,
    { tiers: PerfTier[]; latest: PersonInsight; throughputs: number[] }
  >();
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    for (const p of m?.people ?? []) {
      const e = byPerson.get(p.name) ?? { tiers: [], latest: p, throughputs: [] };
      e.tiers.push(computeTier(p));
      e.throughputs.push(p.throughput);
      e.latest = p;
      byPerson.set(p.name, e);
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
  for (const [name, e] of byPerson) {
    const t = e.throughputs;
    const trend =
      t.length >= 2
        ? t[t.length - 1] > t[t.length - 2]
          ? "up"
          : t[t.length - 1] < t[t.length - 2]
            ? "down"
            : "flat"
        : "flat";
    out.push({
      name,
      latest: e.latest,
      tiers: e.tiers,
      trend,
      context: ctxByName.get(name) ?? null,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
