import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { getProjectPeople } from "@/lib/reports/people-data";
import { buildMatrixRow } from "@/lib/reports/matrix";
import { canAccessPeople } from "@/lib/reports/people-access";
import {
  computeEvaluationConfidence,
  participantMappingCoverage,
  traceabilityCoverage,
} from "@/lib/reports/evaluation-confidence";
import type { PersonInsight, ReportMetrics } from "@/lib/reports/types";

/** Completitud (proxy): fracción de grupos de métricas con datos. */
function completenessOf(m: ReportMetrics | null): number {
  if (!m) return 0;
  return (
    [
      (m.workItems?.total ?? 0) > 0,
      (m.codeChanges?.total ?? 0) > 0,
      (m.ci?.total ?? 0) > 0,
      (m.quality?.bugs ?? 0) > 0,
    ].filter(Boolean).length / 4
  );
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const explicitId =
    new URL(req.url).searchParams.get("projectId") ?? undefined;
  const project = await resolveActiveProject(session.user.id, explicitId);
  if (!project) return NextResponse.json({ rows: [] });
  if (!(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );

  const [people, lastReport] = await Promise.all([
    getProjectPeople(project.id),
    prisma.report.findFirst({
      where: { projectId: project.id },
      orderBy: { periodEnd: "desc" },
      select: { metrics: true },
    }),
  ]);

  const metrics = (lastReport?.metrics as ReportMetrics | null) ?? null;
  const sources = (metrics?.sources ?? []).map((s) => String(s));
  const reportPeople = metrics?.people ?? [];
  const completeness = completenessOf(metrics);

  // Confianza a nivel proyecto (para el badge/aviso "de un vistazo").
  const confidence = computeEvaluationConfidence({
    connectedProviders: sources,
    requiredCategories: ["planning", "code"],
    participantMappingCoverage: participantMappingCoverage(reportPeople),
    dataCompleteness: completeness,
    traceabilityCoverage: traceabilityCoverage(reportPeople),
  });

  // Confianza por persona: mapeo propio + trazabilidad propia + fuentes del proyecto.
  const rows = people.map((p) => {
    const l = p.latest as PersonInsight | null;
    const mapped = !!(l?.id && l.id !== p.name);
    const perPerson = computeEvaluationConfidence({
      connectedProviders: sources,
      requiredCategories: ["planning", "code"],
      participantMappingCoverage: mapped ? 1 : 0.35,
      dataCompleteness: completeness,
      traceabilityCoverage: l ? traceabilityCoverage([l]) : 0.5,
    });
    return { ...buildMatrixRow(p), _conf: perPerson.level };
  });

  return NextResponse.json({ rows, confidence });
}
