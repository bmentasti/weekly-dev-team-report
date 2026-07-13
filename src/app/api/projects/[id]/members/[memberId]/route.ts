import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/project";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; memberId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canManageProject(session.user.id, params.id)))
    return NextResponse.json(
      { error: "Tu rol no permite administrar los miembros del proyecto." },
      { status: 403 },
    );

  await prisma.projectMember.deleteMany({
    where: { id: params.memberId, projectId: params.id },
  });
  return NextResponse.json({ ok: true });
}
