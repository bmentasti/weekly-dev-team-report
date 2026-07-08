import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import type { ReportFrequency } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const project = await resolveActiveProject(session.user.id);
  if (!project) return NextResponse.json({ config: null });

  const config = await prisma.reportConfig.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    config: config
      ? {
          id: config.id,
          frequency: config.frequency,
          recipients: config.recipients,
          lastRunAt: config.lastRunAt,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const project = await resolveActiveProject(session.user.id);
  if (!project)
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    frequency?: string;
    recipients?: string[];
  };
  const frequency = (body.frequency === "WEEKLY" ? "WEEKLY" : "MANUAL") as ReportFrequency;
  const recipients = (body.recipients ?? [])
    .map((r) => r.trim().toLowerCase())
    .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r));

  const existing = await prisma.reportConfig.findFirst({
    where: { projectId: project.id },
  });

  if (existing) {
    await prisma.reportConfig.update({
      where: { id: existing.id },
      data: { frequency, recipients },
    });
  } else {
    await prisma.reportConfig.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        name: "Reporte semanal",
        frequency,
        recipients,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
