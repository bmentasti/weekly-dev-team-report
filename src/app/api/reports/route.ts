import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { computeAlerts } from "@/lib/reports/alerts";
import {
  getEffectiveStandard,
  resolveReportScore,
} from "@/lib/reports/standards-server";
import { resolveWorkspaceForUser, resolveWorkspaceRole } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { historyCutoff, effectivePlan, PLANS } from "@/lib/plans";
import type { ReportMetrics } from "@/lib/reports/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const project = await resolveActiveProject(session.user.id);
  if (!project) {
    return NextResponse.json({ reports: [] });
  }

  // Estándar activo del workspace (umbrales + pesos) para calcular el score.
  const standard = await getEffectiveStandard(project.workspaceId);

  // Ventana de histórico por plan (Free 3m, Team 12m, Pro ilimitado).
  const workspace = await resolveWorkspaceForUser(session.user.id);
  const plan = effectivePlan(workspace);
  const cutoff = historyCutoff(plan);
  const canPdf = PLANS[plan].pdfExport;
  const role = workspace
    ? await resolveWorkspaceRole(session.user.id, workspace.id)
    : null;
  const canGenerate = can(role, "generateReports");

  const raw = await prisma.report.findMany({
    where: {
      projectId: project.id,
      ...(cutoff ? { periodEnd: { gte: cutoff } } : {}),
    },
    orderBy: { periodEnd: "asc" },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      healthStatus: true,
      score: true,
      scoreLevel: true,
      summary: true,
      metrics: true,
      type: true,
      pinned: true,
      reviewedAt: true,
      tags: true,
      createdAt: true,
    },
  });

  let prevScore: number | null = null;
  const enriched = raw.map((r) => {
    const m = r.metrics as ReportMetrics | null;
    // Snapshot congelado (H3) o cálculo con el estándar vigente para reportes previos.
    const { score, level } = resolveReportScore(
      { score: r.score, scoreLevel: r.scoreLevel },
      m,
      r.healthStatus,
      standard,
    );
    const alerts = m && m.capacity ? computeAlerts(m).length : 0;
    const trend =
      prevScore === null
        ? "flat"
        : score > prevScore + 3
          ? "up"
          : score < prevScore - 3
            ? "down"
            : "flat";
    prevScore = score;
    return {
      id: r.id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      status: r.status,
      healthStatus: r.healthStatus,
      summary: r.summary,
      metrics: m,
      type: r.type,
      pinned: r.pinned,
      reviewedAt: r.reviewedAt,
      tags: r.tags,
      createdAt: r.createdAt,
      score,
      level,
      alerts,
      trend,
    };
  });

  // devolver más recientes primero
  enriched.reverse();
  return NextResponse.json({ reports: enriched, canPdf, plan, canGenerate });
}
