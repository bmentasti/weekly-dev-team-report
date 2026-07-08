import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { createReportForProject } from "@/lib/reports/create";
import { deliverReportByEmail } from "@/lib/reports/deliver";

// Ejecuta ahora el envío programado del proyecto activo (para probar sin cron).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const project = await resolveActiveProject(session.user.id);
  if (!project)
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });

  const config = await prisma.reportConfig.findFirst({
    where: { projectId: project.id },
  });
  if (!config || config.recipients.length === 0)
    return NextResponse.json(
      { error: "Configurá destinatarios primero." },
      { status: 400 },
    );

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const report = await createReportForProject(
    project.id,
    project.workspaceId,
    start,
    end,
  );
  const result = await deliverReportByEmail(report.id, config.recipients);
  await prisma.reportConfig.update({
    where: { id: config.id },
    data: { lastRunAt: new Date() },
  });

  if (!result.ok)
    return NextResponse.json(
      { ok: false, reportId: report.id, error: result.error },
      { status: 200 },
    );
  return NextResponse.json({ ok: true, reportId: report.id, sent: result.sent });
}
