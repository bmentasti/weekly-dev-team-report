import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";
import { computeTier, sustainedLow, type PerfTier } from "@/lib/reports/people-profile";
import type { PersonInsight, ReportMetrics } from "@/lib/reports/types";
import { makeResolver, resolvePerson } from "@/lib/reports/identity";
import { getIdentityConfig } from "@/lib/reports/identity-store";
import { autoMergeGroups } from "@/lib/reports/identity-suggest";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const explicitId =
    new URL(req.url).searchParams.get("projectId") ?? undefined;
  const project = await resolveActiveProject(session.user.id, explicitId);
  if (project && !(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );
  if (!project) return NextResponse.json({ alerts: [] });

  const reports = await prisma.report.findMany({
    where: { projectId: project.id },
    orderBy: { periodEnd: "asc" },
    take: 6,
    select: { metrics: true },
  });

  const resolve = makeResolver(await getIdentityConfig(project.id));

  // Pasada 1: identidad canónica por persona.
  const resolved: { p: PersonInsight; id: string; name: string }[] = [];
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    for (const p of m?.people ?? []) {
      const { id, name } = resolvePerson(resolve, p);
      resolved.push({ p, id: id || p.name, name: name || p.name });
    }
  }
  // Auto-merge de alta confianza.
  const distinct = new Map<string, string>();
  for (const r of resolved) if (!distinct.has(r.id)) distinct.set(r.id, r.name);
  const { groupId, displayName } = autoMergeGroups(
    Array.from(distinct, ([id, name]) => ({ id, name })),
  );

  // identidad canónica -> serie de tiers (oldest first) + último insight
  const byPerson = new Map<
    string,
    { tiers: PerfTier[]; latest: PersonInsight; name: string }
  >();
  for (const { p, id, name } of resolved) {
    const key = groupId.get(id) ?? id;
    const entry = byPerson.get(key) ?? { tiers: [], latest: p, name: displayName.get(id) ?? name };
    entry.tiers.push(computeTier(p));
    entry.latest = p;
    entry.name = displayName.get(id) ?? name;
    byPerson.set(key, entry);
  }

  const alerts = [];
  for (const { tiers, latest, name } of byPerson.values()) {
    const s = sustainedLow(tiers);
    if (!s) continue;
    const evidence: string[] = [];
    if (latest.tasksBlocked > 0) evidence.push(`${latest.tasksBlocked} bloqueada(s)`);
    if (latest.tasksStale > 0) evidence.push(`${latest.tasksStale} sin movimiento`);
    if (latest.completedPoints === 0) evidence.push("sin SP completados");
    if (latest.throughput <= 1) evidence.push("bajo throughput");
    alerts.push({
      name,
      sprints: s.sprints,
      severity: s.severity,
      escalate: s.escalate,
      evidence: evidence.join(", ") || "señales bajas sostenidas",
      conversation:
        "1:1 privado para entender contexto (claridad, acompañamiento, disponibilidad) y acordar objetivos.",
      nextAction: s.escalate
        ? "Si ya hubo acompañamiento sin mejora, considerar escalar a liderazgo/RRHH."
        : "Definir plan de acompañamiento y objetivos medibles para el próximo sprint.",
      reviewInDays: 14,
    });
  }

  alerts.sort((a, b) => (b.severity === "alta" ? 1 : 0) - (a.severity === "alta" ? 1 : 0));
  return NextResponse.json({ alerts });
}
