import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";
import { computeTier, sustainedLow, type PerfTier } from "@/lib/reports/people-profile";
import type { PersonInsight, ReportMetrics } from "@/lib/reports/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const project = await resolveActiveProject(session.user.id);
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

  // name -> serie de tiers (oldest first) + último insight
  const byPerson = new Map<string, { tiers: PerfTier[]; latest: PersonInsight }>();
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    for (const p of m?.people ?? []) {
      const entry = byPerson.get(p.name) ?? { tiers: [], latest: p };
      entry.tiers.push(computeTier(p));
      entry.latest = p;
      byPerson.set(p.name, entry);
    }
  }

  const alerts = [];
  for (const [name, { tiers, latest }] of byPerson) {
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
