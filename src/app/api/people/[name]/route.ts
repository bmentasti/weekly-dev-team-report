import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";
import {
  computeTier,
  type PersonProfile,
  type PersonSprintPoint,
} from "@/lib/reports/people-profile";
import type { PersonInsight, ReportMetrics } from "@/lib/reports/types";

export async function GET(
  _request: Request,
  { params }: { params: { name: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const project = await resolveActiveProject(session.user.id);
  if (project && !(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );
  if (!project)
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });

  const name = decodeURIComponent(params.name);

  const reports = await prisma.report.findMany({
    where: { projectId: project.id },
    orderBy: { periodEnd: "asc" },
    take: 10,
    select: { periodEnd: true, metrics: true },
  });

  const points: PersonSprintPoint[] = [];
  let latest: PersonInsight | null = null;
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    const person = m?.people?.find((p) => p.name === name);
    if (!person) continue;
    latest = person;
    points.push({
      label: new Date(r.periodEnd).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      }),
      tasksDone: person.tasksDone,
      throughput: person.throughput,
      completedPoints: person.completedPoints,
      blocked: person.tasksBlocked,
      stale: person.tasksStale,
      tier: computeTier(person),
    });
  }

  let trend: PersonProfile["trend"] = "flat";
  if (points.length >= 2) {
    const a = points[points.length - 1].throughput;
    const b = points[points.length - 2].throughput;
    trend = a > b ? "up" : a < b ? "down" : "flat";
  }

  const profile: PersonProfile = {
    name,
    points,
    latest,
    tier: computeTier(latest),
    trend,
  };
  return NextResponse.json({ profile });
}
