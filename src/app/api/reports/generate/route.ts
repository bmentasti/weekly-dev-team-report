import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { resolveWorkspaceForUser } from "@/lib/workspace";
import { createReportForProject } from "@/lib/reports/create";
import { PLANS, effectivePlan } from "@/lib/plans";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { periodStart?: string; periodEnd?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // empty body is fine — defaults apply
  }

  const project = await resolveActiveProject(session.user.id);
  if (!project) {
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });
  }

  const connectedCount = await prisma.integration.count({
    where: { projectId: project.id, status: "CONNECTED" },
  });
  if (connectedCount === 0) {
    return NextResponse.json(
      { error: "Conectá al menos una herramienta antes de generar un reporte." },
      { status: 400 },
    );
  }

  // Cap de reportes/mes por plan (Free = 10). (Pricing)
  const workspace = await resolveWorkspaceForUser(session.user.id);
  const plan = effectivePlan(workspace);
  const cap = PLANS[plan].maxReportsPerMonth;
  if (cap !== null && workspace) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const usedThisMonth = await prisma.report.count({
      where: { workspaceId: workspace.id, createdAt: { gte: startOfMonth } },
    });
    if (usedThisMonth >= cap) {
      return NextResponse.json(
        {
          error: `Alcanzaste el límite de ${cap} reportes este mes en el plan Free. Actualizá a Team para generar sin límite.`,
          requiresUpgrade: true,
        },
        { status: 402 },
      );
    }
  }

  const periodEnd = body.periodEnd ? new Date(body.periodEnd) : new Date();
  const periodStart = body.periodStart
    ? new Date(body.periodStart)
    : new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const report = await createReportForProject(
      project.id,
      project.workspaceId,
      periodStart,
      periodEnd,
    );
    return NextResponse.json({ id: report.id });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al generar el reporte.",
      },
      { status: 500 },
    );
  }
}
