import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/project";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; memberId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canAccessProject(session.user.id, params.id)))
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  await prisma.projectMember.deleteMany({
    where: { id: params.memberId, projectId: params.id },
  });
  return NextResponse.json({ ok: true });
}
