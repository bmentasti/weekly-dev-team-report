import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/project";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canAccessProject(session.user.id, params.id)))
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();
  if (name.length < 2)
    return NextResponse.json({ error: "Nombre inválido." }, { status: 400 });

  const project = await prisma.project.update({
    where: { id: params.id },
    data: { name },
  });
  return NextResponse.json({ project: { id: project.id, name: project.name } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canAccessProject(session.user.id, params.id)))
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { workspaceId: true },
  });
  if (!project)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const count = await prisma.project.count({
    where: { workspaceId: project.workspaceId },
  });
  if (count <= 1)
    return NextResponse.json(
      { error: "No podés eliminar el único proyecto del workspace." },
      { status: 400 },
    );

  // Remove reports of this project (they'd otherwise quedar huérfanos), then the
  // project (integrations y members se borran en cascada).
  await prisma.report.deleteMany({ where: { projectId: params.id } });
  await prisma.project.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
