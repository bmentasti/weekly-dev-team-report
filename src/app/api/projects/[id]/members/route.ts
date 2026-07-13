import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject, canManageProject } from "@/lib/project";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canAccessProject(session.user.id, params.id)))
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canManageProject(session.user.id, params.id)))
    return NextResponse.json(
      { error: "Tu rol no permite administrar los miembros del proyecto." },
      { status: 403 },
    );

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    email?: string;
  };

  let userId = body.userId ?? null;
  if (!userId && body.email) {
    const user = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user)
      return NextResponse.json(
        { error: "No existe un usuario con ese email." },
        { status: 404 },
      );
    userId = user.id;
  }
  if (!userId)
    return NextResponse.json({ error: "Indicá un usuario." }, { status: 400 });

  const dupe = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId } },
  });
  if (dupe)
    return NextResponse.json({ error: "Ya es miembro." }, { status: 409 });

  await prisma.projectMember.create({
    data: { projectId: params.id, userId, role: "MEMBER" },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
