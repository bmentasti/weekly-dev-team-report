import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { parseBody } from "@/lib/api";
import { reportConfigSchema } from "@/lib/validations";
import type { Prisma, ReportFrequency } from "@prisma/client";

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
          // `locale` vía cast: el cliente Prisma se regenera en el entorno del
          // usuario (`prisma generate`) tras aplicar el nuevo campo del schema.
          locale: (config as { locale?: string }).locale ?? "es",
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

  const { data, error } = await parseBody(request, reportConfigSchema);
  if (error) return error;
  const frequency = data.frequency as ReportFrequency;
  const recipients = Array.from(
    new Set(data.recipients.map((r) => r.trim().toLowerCase())),
  );

  const existing = await prisma.reportConfig.findFirst({
    where: { projectId: project.id },
  });

  // `locale` es un campo nuevo del schema; el cliente Prisma se regenera en el
  // entorno del usuario (`prisma generate`), así que casteamos el `data`.
  if (existing) {
    await prisma.reportConfig.update({
      where: { id: existing.id },
      data: { frequency, recipients, locale: data.locale } as unknown as Prisma.ReportConfigUncheckedUpdateInput,
    });
  } else {
    await prisma.reportConfig.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        name: "Reporte semanal",
        frequency,
        recipients,
        locale: data.locale,
      } as unknown as Prisma.ReportConfigUncheckedCreateInput,
    });
  }

  return NextResponse.json({ ok: true });
}
